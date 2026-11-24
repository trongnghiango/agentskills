# Git Guardian — Standard Workflows

> **User Communication Convention**: All prompts, questions, and status updates delivered to the user must match the user's language (Vietnamese when prompted in Vietnamese).

---

## Workflow 1: Starting a New Task

```bash
# Step 1: Pre-flight inspection
git status
git branch --show-current
git rev-parse HEAD

# Step 2: If dirty → prompt user for permission to proceed
# Step 3: If on main/master → halt and alert user immediately

# Step 4: Review task scope and verify file boundaries
# Step 5: Begin editing safely
```

---

## Workflow 2: Completing a Task & Committing

```bash
# Step 1: Post-flight inspection
git status
git diff

# Step 2: Review changes
git diff --stat

# Step 3: Prompt user for confirmation
# (In Vietnamese: "Tôi đã chỉnh sửa X file. Bạn có muốn commit với message '[feat]: ...' không?")
# (In English: "I have modified X files. Would you like me to commit with message '[feat]: ...'?")

# Step 4: Await user approval

# Step 5: Stage specific files only (Never use `git add .` unless requested)
git add <target-file-1> <target-file-2>

# Step 6: Commit with conventional message
git commit -m "<type>(<scope>): <concise description>"

# Step 7: Report commit hash and summary
git log --oneline -1
```

---

## Workflow 3: Creating and Switching to a Feature Branch

```bash
# Condition: User explicitly requested a branch creation

# Step 1: Check current state
git status
git branch --show-current

# Step 2: Confirm base branch with user
# Prompt: "Would you like to branch off 'main' or the current branch 'X'?"

# Step 3: Create and switch (only upon explicit instruction)
git checkout -b feature/<name>
# or
git switch -c feature/<name>

# Step 4: Verify current branch
git branch --show-current
```

---

## Workflow 4: Merging Feature into Main (Explicit Request Only)

```bash
# Step 1: High-risk alert — this is a DANGEROUS operation
# Alert: "About to merge feature/X into main. This operation cannot be easily undone."

# Step 2: Inspect incoming commits
git status
git log main..feature/X --oneline

# Step 3: Confirm with user regarding commit count and diff scope

# Step 4: Checkout main (only after explicit confirmation)
git checkout main
git pull origin main

# Step 5: Merge with no-ff
git merge --no-ff feature/X

# Step 6: If conflicts occur → STOP immediately, report state, await instructions

# Step 7: If clean → report result
git log --oneline -5
```

---

## Workflow 5: Handling Merge Conflicts

```bash
# Situation: Merge/rebase encountered a conflict

# Step 1: STOP IMMEDIATELY — do not attempt automated brute-force resolution
# Step 2: Capture conflict status
git status

# Step 3: Report conflict list to user in their language
# Step 4: Propose manual or assisted review file-by-file
# Step 5: Never run `git checkout --ours / --theirs` without explicit user instruction
```
