---
id: fixture-good
status: done
acceptance_criteria:
  - "greeting returns correct string"
---

## Evidence

Acceptance criterion "greeting returns correct string":
```bash
$ node -e "import('./src/hello.js').then(m=>console.log(m.hello('x')))"
hi, x
```
