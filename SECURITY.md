# Security: HTML Escaping

## Issue Description

When embedding user-provided data (like file names or paths) into HTML attributes via string interpolation, special characters can break JavaScript syntax and cause security vulnerabilities.

### Example Problem

If a file is named `test's file.txt`, embedding it directly into an `onclick` attribute would generate invalid JavaScript:

```html
<!-- ❌ BROKEN - Single quote breaks JavaScript -->
<button onclick="deleteFile('test's file.txt', 'test's file.txt')">Delete</button>
```

This results in a JavaScript syntax error because the single quote in the filename terminates the string prematurely.

## Solution

### For React/JSX (Current Implementation)

The current Next.js/React implementation uses proper event handlers, which automatically handle escaping:

```jsx
// ✅ SAFE - React handles escaping automatically
<button onClick={() => deleteFile(file.path, file.name)}>Delete</button>
```

React automatically escapes all values passed to event handlers, so this is safe.

### For Plain HTML/String Templates

If you need to generate HTML strings (e.g., for server-side rendering or email templates), use the provided escaping functions:

#### Client-Side (`utils/clientHelpers.js`)

```javascript
import { escapeHtml, escapeHtmlAttribute, escapeJsString } from '../utils/clientHelpers';

// For HTML content (text nodes)
const safeText = escapeHtml(userInput); // Escapes: < > & " '

// For HTML attributes
const safeAttr = escapeHtmlAttribute(userInput); // Escapes: < > & " ' (with &#39; for single quotes)

// For JavaScript strings
const safeJs = escapeJsString(userInput); // Escapes: \ ' " \n \r \t
```

#### Server-Side (`utils/serverHelpers.js`)

```javascript
import { escapeHtml, escapeHtmlAttribute, escapeJsString } from '../utils/serverHelpers';

// Same functions available on server-side
const safeText = escapeHtml(userInput);
const safeAttr = escapeHtmlAttribute(userInput);
const safeJs = escapeJsString(userInput);
```

### Example Usage

```javascript
// ❌ UNSAFE - Direct string interpolation
const html = `<button onclick="deleteFile('${fileName}', '${fileName}')">Delete</button>`;

// ✅ SAFE - Using escapeJsString for JavaScript context
const html = `<button onclick="deleteFile('${escapeJsString(fileName)}', '${escapeJsString(fileName)}')">Delete</button>`;

// ✅ SAFE - Using escapeHtmlAttribute for HTML attributes
const html = `<button data-filename="${escapeHtmlAttribute(fileName)}">Delete</button>`;

// ✅ SAFE - Using escapeHtml for text content
const html = `<span>${escapeHtml(fileName)}</span>`;
```

## Functions Provided

### `escapeHtml(text)`
- **Purpose**: Escape HTML content for text nodes
- **Escapes**: `<`, `>`, `&`, `"`, `'`
- **Use case**: Displaying user input in HTML text content

### `escapeHtmlAttribute(text)`
- **Purpose**: Escape HTML attribute values
- **Escapes**: `<`, `>`, `&`, `"`, `'` (single quotes become `&#39;`)
- **Use case**: Embedding user input in HTML attributes like `data-*`, `title`, `alt`, etc.

### `escapeJsString(text)`
- **Purpose**: Escape JavaScript string literals
- **Escapes**: `\`, `'`, `"`, `\n`, `\r`, `\t`
- **Use case**: Embedding user input in JavaScript code (e.g., in `onclick` handlers, JSON, etc.)

## Current Status

✅ **Fixed**: The current React implementation is safe because it uses proper event handlers.

✅ **Added**: Escaping utility functions are now available for any future use cases that require string interpolation.

✅ **Fixed**: HTTP header escaping in download API now properly handles special characters in filenames.

## Best Practices

1. **Prefer React event handlers** over string interpolation for dynamic content
2. **Never trust user input** - always escape when embedding in HTML/JS
3. **Use the appropriate escaping function** for the context (HTML content vs attributes vs JS)
4. **Test with edge cases** like filenames with quotes, newlines, and special characters

## Testing

Test cases that should work correctly:

- `test's file.txt` (single quote)
- `file"name".pdf` (double quote)
- `file<script>.js` (HTML tags)
- `file&name.txt` (ampersand)
- `file\nname.txt` (newline)
- `file\\name.txt` (backslash)
