# Java / Spring Boot Clean Architecture Blueprint

This blueprint describes the specific implementation standards for Java and Spring Boot backend applications.

---

## 1. Technical Stack & Patterns

| Element | Tool / Library | Specification |
| :--- | :--- | :--- |
| **Language** | Java 17+ | strict type safety |
| **Framework** | Spring Boot | Web / Validation / Core DI |
| **Persistence** | Spring Data JPA / JDBC | SQL Database |
| **DI Injection**| Spring Autowired | Constructor-based DI (implicit Autowired) |
| **Transactions**| `@Transactional` | Defined at the Application Service layer |
| **Tenant Isolation**| ThreadLocal Context | Propagated implicitly through a custom filter/interceptor |
| **Exceptions**  | `@RestControllerAdvice` | Map custom domain exception classes to HTTP responses |

---

## 2. Standard Code Blueprints

### A. Pure Domain Entity (Java - No Framework Leak)
```java
package com.mycompany.myapp.domain.model;

import com.mycompany.myapp.domain.exception.BusinessRuleValidationException;

public class Member {
    private final String id;
    private final String tenantId;
    private String name;
    private String status;

    // Constructor enforcing domain invariants
    public Member(String id, String tenantId, String name, String status) {
        if (name == null || name.trim().isEmpty()) {
            throw new BusinessRuleValidationException("Member name cannot be empty.");
        }
        this.id = id;
        this.tenantId = tenantId;
        this.name = name;
        this.status = status != null ? status : "ACTIVE";
    }

    // Getters only, no Setters
    public String getId() { return id; }
    public String getTenantId() { return tenantId; }
    public String getName() { return name; }
    public String getStatus() { return status; }

    // Business behaviors modifying state
    public void deactivate() {
        if ("INACTIVE".equals(this.status)) {
            throw new BusinessRuleValidationException("Member is already inactive.");
        }
        this.status = "INACTIVE";
    }

    public void rename(String newName) {
        if (newName == null || newName.trim().isEmpty()) {
            throw new BusinessRuleValidationException("Name is invalid.");
        }
        this.name = newName.trim();
    }
}
```

### B. Repository Port (Interface)
```java
package com.mycompany.myapp.domain.ports;

import com.mycompany.myapp.domain.model.Member;
import java.util.Optional;

public interface MemberRepository {
    Optional<Member> findById(String id, String tenantId);
    Member save(Member member);
}
```

### C. Infrastructure Layer - JPA Entity Schema
```java
package com.mycompany.myapp.infrastructure.persistence.entities;

import jakarta.persistence.*;

@Entity
@Table(name = "members", indexes = {
    @Index(name = "idx_members_tenant_id", columnList = "tenant_id")
})
public class MemberJpaEntity {
    @Id
    private String id;

    @Column(name = "tenant_id", nullable = false)
    private String tenantId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String status;

    // Getters, Setters, No-Args Constructor
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getTenantId() { return tenantId; }
    public void setTenantId(String tenantId) { this.tenantId = tenantId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
```

### D. Infrastructure Mapper & Repository Adapter
```java
package com.mycompany.myapp.infrastructure.persistence.adapters;

import com.mycompany.myapp.domain.model.Member;
import com.mycompany.myapp.domain.ports.MemberRepository;
import com.mycompany.myapp.infrastructure.persistence.entities.MemberJpaEntity;
import com.mycompany.myapp.infrastructure.persistence.repositories.SpringDataMemberRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public class JpaMemberRepository implements MemberRepository {
    private final SpringDataMemberRepository jpaRepo;

    public JpaMemberRepository(SpringDataMemberRepository jpaRepo) {
        this.jpaRepo = jpaRepo;
    }

    @Override
    public Optional<Member> findById(String id, String tenantId) {
        return jpaRepo.findByIdAndTenantId(id, tenantId)
                .map(this::toDomain);
    }

    @Override
    public Member save(Member member) {
        MemberJpaEntity entity = toPersistence(member);
        MemberJpaEntity saved = jpaRepo.save(entity);
        return toDomain(saved);
    }

    // Mapper conversion methods
    private Member toDomain(MemberJpaEntity entity) {
        return new Member(entity.getId(), entity.getTenantId(), entity.getName(), entity.getStatus());
    }

    private MemberJpaEntity toPersistence(Member domain) {
        MemberJpaEntity entity = new MemberJpaEntity();
        entity.setId(domain.getId());
        entity.setTenantId(domain.getTenantId());
        entity.setName(domain.getName());
        entity.setStatus(domain.getStatus());
        return entity;
    }
}
```

### E. Application Service Layer (Use Cases)
```java
package com.mycompany.myapp.application.services;

import com.mycompany.myapp.domain.model.Member;
import com.mycompany.myapp.domain.ports.MemberRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.NoSuchElementException;

@Service
public class MemberApplicationService {
    private final MemberRepository repo;

    public MemberApplicationService(MemberRepository repo) {
        this.repo = repo;
    }

    @Transactional
    public void deactivateMember(String id, String tenantId) {
        // Enforce dynamic tenant isolation via repository queries
        Member member = repo.findById(id, tenantId)
                .orElseThrow(() -> new NoSuchElementException("Member not found in current organization."));

        member.deactivate();
        repo.save(member);
    }
}
```

### F. Tenant ThreadLocal Context & Filter
```java
package com.mycompany.myapp.infrastructure.context;

public class TenantContext {
    private static final ThreadLocal<String> CURRENT_TENANT = new ThreadLocal<>();

    public static String getTenantId() {
        return CURRENT_TENANT.get();
    }

    public static void setTenantId(String tenantId) {
        CURRENT_TENANT.set(tenantId);
    }

    public static void clear() {
        CURRENT_TENANT.remove();
    }
}
```

### G. Presentation REST Controller
```java
package com.mycompany.myapp.presentation.controllers;

import com.mycompany.myapp.application.services.MemberApplicationService;
import com.mycompany.myapp.infrastructure.context.TenantContext;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/members")
public class MemberController {
    private final MemberApplicationService service;

    public MemberController(MemberApplicationService service) {
        this.service = service;
    }

    @PostMapping("/{id}/deactivate")
    public ResponseEntity<Void> deactivate(@PathVariable String id) {
        // Extract tenant ID implicitly resolved from JWT filter
        String tenantId = TenantContext.getTenantId();
        
        service.deactivateMember(id, tenantId);
        return ResponseEntity.ok().build();
    }
}
```

---

## 3. Java Verification Checklist
Verify purity and build consistency:
```bash
# Verify Maven build compilation succeeds
mvn clean compile

# Verify Domain does not leak Spring framework or JPA Hibernate code (should return empty output)
grep -r "org.springframework\|jakarta.persistence" src/main/java/com/mycompany/myapp/domain/
```
