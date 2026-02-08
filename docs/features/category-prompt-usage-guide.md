# Category Prompt Usage Guide (Advanced Settings)

**Who this is for:** Admins and product configuration owners  
**Goal:** Improve SuperInbox auto-classification quality quickly without code changes.

---

## 1. What this feature can do

In **Advanced Settings** on the "Category Management" page, you can:

- View and edit the current prompt
- Use AI to generate prompts (3 strategies)
- Click "Save and Apply" to make changes effective immediately
- Roll back to the previous version when results are not ideal

> Note: The "prompt" here is the system rule set used by the classifier. It determines how AI classifies content, extracts entities, and outputs JSON.

---

## 2. Core mechanism you should remember (most important)

Category prompt management can be understood as a **two-stage mechanism**:

- Generation stage: choose Low Cost / High Precision / Custom to decide how the prompt is generated
- Runtime stage: auto-classification always runs with "the currently saved prompt + runtime category configuration injection"

This means:

1. You update category rules (description, examples, active status)
2. No backend code changes are needed
3. As long as required runtime placeholders are kept, new rules will take effect in subsequent classifications

---

## 3. How to choose among the 3 generation modes

### 3.1 Low Cost

Best for: fast daily iteration and cost-sensitive scenarios.  
Characteristics: shorter prompts and lower token usage.

### 3.2 High Precision

Best for: scenarios that require high accuracy and consistency.  
Characteristics: more complete rules, clearer boundaries, more stable output.  
Additional requirement scope: can only **extend classification rules**, and must not break safety, output constraints, or category-key constraints.

### 3.3 Custom

Best for: cases where you have explicit business preferences and need tailored logic.  
Characteristics: keeps only 3 hard guardrails (safety / output constraints / category-key constraints), and customizes everything else based on your requirement.  
You can specify target language (e.g., French), category priority order, extra decision dimensions, etc.

> Note: In Custom mode, "Requirement" is mandatory. Generation cannot be submitted if it is empty.

### 3.4 Language rules

- Low Cost and High Precision: generated in the current page language by default
- Custom: if a target language is specified in your requirement, that language is used; otherwise, current page language is used

---

## 4. Recommended workflow

1. Maintain categories first (name, rule description, examples)
2. Open Advanced Settings, click "Generate" and choose a mode
3. Generated content is first filled into the editor; click "Save and Apply" to make it effective
4. Test with real samples
5. If performance regresses, click "Rollback to Previous Version" (with confirmation)

---

## 5. Placeholder reference (do not remove casually)

In generated templates (especially High Precision and Custom), you may see these placeholders:

- `{{NOW_ISO}}`: current timestamp (ISO)
- `{{TIMEZONE}}`: user timezone
- `{{CONTENT_TYPE}}`: content type
- `{{CONTENT}}`: content body to analyze
- `{{ACTIVE_CATEGORY_KEYS_JSON}}`: list of currently active category keys
- `{{CATEGORY_RULES_JSON}}`: current category rule configuration
- `{{FALLBACK_CATEGORY_KEY}}`: fallback category key (usually `unknown`)

These placeholders are replaced with real runtime values automatically.  
If required placeholders are removed, save will be blocked by system validation.

---

## 6. Save validation rules (system-enforced)

When you click "Save and Apply", the system performs strict validation, including:

- Must include all 7 runtime placeholders (`NOW_ISO`, `TIMEZONE`, `CONTENT_TYPE`, `CONTENT`, `ACTIVE_CATEGORY_KEYS_JSON`, `CATEGORY_RULES_JSON`, `FALLBACK_CATEGORY_KEY`)
- Must clearly constrain output to JSON only
- Must clearly constrain `category` to active category keys
- Must clearly define `unknown` as fallback only
- Total prompt length must not exceed 20000 characters

---

## 7. Example: why changing category rules can affect results immediately

Suppose you change the `schedule` description from:

- "Arrangements or meetings with time points"

to:

- "Arrangements with explicit date, relative date (tomorrow/next Tuesday), or time window; prefer `schedule`"

and add examples:

- "Meet supplier next Tuesday afternoon"
- "Submit review comments tomorrow at 10 AM"

Then similar texts are more likely to be classified as `schedule`, because the latest category rules are injected at runtime.

---

## 8. FAQ

### Q1: Why do I still see `unknown`?
A: `unknown` is the system fallback category. It should be used only when no other category can match. If it appears too often, improve descriptions and examples for relevant categories. The system protects this category: it cannot be deleted, disabled, or renamed to a non-`unknown` key.

### Q2: Why does "Save and Apply" feel like it made no difference?
A: Check these first:
- Whether your test samples actually cover the adjusted rules
- Whether the target category is active
- Whether key constraints/placeholders were accidentally removed from the prompt

### Q3: In Custom mode, can I require French output or add new dimensions?
A: Yes. As long as safety, output format, and category-key constraints are respected, Custom mode prioritizes your requirement. You can request French output, define category priority, or add extra decision dimensions.

### Q4: What happens when I roll back to the previous version?
A: The current prompt is replaced by the previous version and becomes effective immediately. Any unsaved edits in the current editor are lost.

### Q5: Why can saving fail?
A: Common causes include missing required placeholders, missing JSON-only constraint, missing category-key constraint, missing `unknown` fallback rule, or prompt length exceeding 20000 characters.

---

## 9. Best practices

- Change one type of rule at a time to observe impact clearly
- Keep category descriptions actionable and judgeable; avoid overly abstract wording
- Use examples that cover edge cases (easy-to-misclassify sentences)
- Copy a backup of your prompt before large edits
- For misclassification issues, improve category rules/examples first, then consider rewriting large prompt sections

---

## 10. Conclusion

You can think of "Category Management + Advanced Prompt" as a configurable classification engine:

- Category Management provides business knowledge (rules and examples)
- Prompt provides the reasoning framework (how to classify and how to output)
- Together, they enable continuous classification quality improvement without code changes
