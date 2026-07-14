# Go (Golang) Clean Architecture Blueprint

This blueprint describes the specific implementation standards for Go (Golang) backend applications.

---

## 1. Technical Stack & Patterns

| Element | Tool / Library | Specification |
| :--- | :--- | :--- |
| **Language** | Go (Golang) | Clean codebase, standard modules |
| **HTTP Framework** | standard `net/http` / Gin / Fiber | Decoupled routing from business logic |
| **Database Access**| `pgx` / `sqlx` / GORM | SQL database driver and queries |
| **Tenant Isolation**| `context.Context` | Thread-safe, implicit propagation of user/tenant context down the call tree |
| **Dependency Injection** | Constructor Composition | Factory functions (e.g., `NewUseCase(...)`) |

---

## 2. Standard Code Blueprints

### A. Pure Domain Entity (Go)
```go
package domain

import (
	"errors"
	"strings"
)

var (
	ErrInvalidTitle   = errors.New("title cannot be empty")
	ErrAlreadyFinished = errors.New("task is already finished")
)

// Task represents the pure core business entity
type Task struct {
	id          string
	tenantID    string
	title       string
	description string
	isFinished  bool
}

// NewTask creates a new Task entity and enforces invariants
func NewTask(id, tenantID, title, description string) (*Task, error) {
	if strings.TrimSpace(title) == "" {
		return nil, ErrInvalidTitle
	}
	return &Task{
		id:          id,
		tenantID:    tenantID,
		title:       title,
		description: description,
		isFinished:  false,
	}, nil
}

// Getters to restrict direct mutation
func (t *Task) ID() string          { return t.id }
func (t *Task) TenantID() string    { return t.tenantID }
func (t *Task) Title() string       { return t.title }
func (t *Task) Description() string { return t.description }
func (t *Task) IsFinished() bool    { return t.isFinished }

// Complete changes task status following business rules
func (t *Task) Complete() error {
	if t.isFinished {
		return ErrAlreadyFinished
	}
	t.isFinished = true
	return nil
}
```

### B. Repository Port (Interface)
```go
package domain

import "context"

type TaskRepository interface {
	FindByID(ctx context.Context, id string) (*Task, error)
	Save(ctx context.Context, task *Task) error
}
```

### C. Infrastructure Mapper & Database Schema Struct
```go
package repository

import (
	"database/sql"
	"myproject/domain"
)

// dbTask defines the database structure (persistence schema)
type dbTask struct {
	ID          string         `db:"id"`
	TenantID    string         `db:"tenant_id"`
	Title       string         `db:"title"`
	Description sql.NullString `db:"description"`
	IsFinished  bool           `db:"is_finished"`
}

// ToDomain maps database records to domain objects
func ToDomain(db *dbTask) *Task {
	// Re-construct aggregate bypassing validator since data is already persistence-proven
	return &domain.Task{
		id:          db.ID,
		tenantID:    db.TenantID,
		title:       db.Title,
		description: db.Description.String,
		isFinished:  db.IsFinished,
	}
}

// ToPersistence maps domain aggregates to database records
func ToPersistence(t *domain.Task) *dbTask {
	return &dbTask{
		ID:       t.ID(),
		TenantID: t.TenantID(),
		Title:    t.Title(),
		Description: sql.NullString{
			String: t.Description(),
			Valid:  t.Description() != "",
		},
		IsFinished: t.IsFinished(),
	}
}
```

### D. Repository Adapter (sqlx & implicit Tenant Isolation)
```go
package repository

import (
	"context"
	"database/sql"
	"errors"
	"myproject/domain"

	"github.com/jmoiron/sqlx"
)

type SqlxTaskRepository struct {
	db *sqlx.DB
}

func NewSqlxTaskRepository(db *sqlx.DB) domain.TaskRepository {
	return &SqlxTaskRepository{db: db}
}

func (r *SqlxTaskRepository) FindByID(ctx context.Context, id string) (*domain.Task, error) {
	// Extract tenant ID implicitly from context
	tenantID, ok := ctx.Value("tenant_id").(string)
	if !ok || tenantID == "" {
		return nil, errors.New("unauthorized: missing tenant context")
	}

	var row dbTask
	query := "SELECT id, tenant_id, title, description, is_finished FROM tasks WHERE id = $1 AND tenant_id = $2 LIMIT 1"
	err := r.db.GetContext(ctx, &row, query, id, tenantID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return ToDomain(&row), nil
}

func (r *SqlxTaskRepository) Save(ctx context.Context, task *domain.Task) error {
	tenantID, ok := ctx.Value("tenant_id").(string)
	if !ok || tenantID != task.TenantID() {
		return errors.New("unauthorized tenant modification")
	}

	data := ToPersistence(task)
	query := `
		INSERT INTO tasks (id, tenant_id, title, description, is_finished) 
		VALUES (:id, :tenant_id, :title, :description, :is_finished)
		ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, is_finished = EXCLUDED.is_finished
	`
	_, err := r.db.NamedExecContext(ctx, query, data)
	return err
}
```

### E. Application Service (Use Case)
```go
package usecase

import (
	"context"
	"myproject/domain"
)

type CompleteTaskUseCase struct {
	repo domain.TaskRepository
}

func NewCompleteTaskUseCase(repo domain.TaskRepository) *CompleteTaskUseCase {
	return &CompleteTaskUseCase{repo: repo}
}

func (uc *CompleteTaskUseCase) Execute(ctx context.Context, taskID string) error {
	// Find task using tenant-isolated query
	task, err := uc.repo.FindByID(ctx, taskID)
	if err != nil {
		return err
	}
	if task == nil {
		return errors.New("task not found")
	}

	// Trigger domain state modification
	if err := task.Complete(); err != nil {
		return err
	}

	// Persist
	return uc.repo.Save(ctx, task)
}
```

### F. HTTP Controller Handler (Gin example)
```go
package handler

import (
	"context"
	"net/http"
	"myproject/usecase"

	"github.com/gin-gonic/gin"
)

type TaskHandler struct {
	completeUC *usecase.CompleteTaskUseCase
}

func NewTaskHandler(completeUC *usecase.CompleteTaskUseCase) *TaskHandler {
	return &TaskHandler{completeUC: completeUC}
}

func (h *TaskHandler) Complete(c *gin.Context) {
	taskID := c.Param("id")
	
	// Extract tenant ID from auth middleware session
	tenantID, exists := c.Get("currentUserTenantID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	// Bundle tenant context implicitly in standard context.Context
	ctx := context.WithValue(c.Request.Context(), "tenant_id", tenantID)

	err := h.completeUC.Execute(ctx, taskID)
	if err != nil {
		// Map domain error code to HTTP transport error code
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}
```

---

## 3. Go Verification Command
Ensure dependency rules:
```bash
# Verify compilation succeeds
go build ./...

# Verify that domain directory does not import gin, fiber, or databases (should return empty output)
go list -f '{{.Imports}}' ./domain/... | grep -E "gin|fiber|database|sqlx|gorm"
```
