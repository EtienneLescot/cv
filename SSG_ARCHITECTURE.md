# Static Site Generation (SSG) Architecture for Multi-Locale Support

## Overview

This document describes the robust Static Site Generation (SSG) architecture implemented for handling multi-locale support with complex HTML content. The solution addresses the original inject-fallback.js issues by using proper DOM parsing instead of regex, ensuring HTML5 compliance and preventing content corruption.

## Architecture Diagram

```mermaid
graph TD
    A[index.html Template] --> B[build-static-locales.js]
    C[locales/*.json] --> B
    B --> D[DOM Parser (JSDOM)]
    D --> E[Template Processor]
    E --> F[Generated Static Files]
    F --> G[index-fr.html]
    F --> H[index-en.html]
    F --> I[index-{locale}.html]

    J[Browser Detection] --> K{Language?}
    K -->|fr| G
    K -->|en| H
    K -->|other| L[Default Locale]

    M[Build Pipeline] --> B
    N[.gitignore] --> O[Exclude Generated Files]
    P[Prettier Validation] --> F
```

## Key Components

### 1. Template File (`index.html`)
- Clean HTML5 template with `data-i18n` attributes as placeholders
- Stored in git as the source of truth
- Contains no hardcoded content, only structure

### 2. Locale Files (`locales/*.json`)
- JSON files containing translations for each locale
- Support complex HTML content including:
  - Nested tags: `<strong><a href="...">AppKiosk</a></strong>`
  - HTML entities: `&nbsp;`, `&`
  - Complex attributes: `href="mailto:..."`
  - Mixed content with `<br>` tags

### 3. Build Script (`build-static-locales.js`)
- Uses JSDOM for proper DOM parsing (no regex)
- Processes template and injects locale content
- Generates static HTML files for each locale
- Includes comprehensive error handling and logging

### 4. Generated Files (`index-{locale}.html`)
- Static HTML files with all content pre-rendered
- Excluded from git via `.gitignore`
- Ready for deployment to CDN or static hosting

## Technical Implementation

### DOM Parsing Approach

The core innovation is using JSDOM for proper HTML parsing:

```javascript
const dom = new JSDOM(templateHtml);
const { document } = dom.window;

// Update document language
document.documentElement.lang = localeName;

// Process all elements with data-i18n attributes
const i18nElements = document.querySelectorAll('[data-i18n]');
i18nElements.forEach(element => {
  const key = element.getAttribute('data-i18n');
  const translation = localeData[key];

  if (translation !== undefined) {
    // Use proper DOM methods to set content, preserving HTML structure
    element.innerHTML = translation;
  }
});
```

### HTML Entity Handling

The DOM parser automatically handles HTML entities correctly:
- Input: `Email&nbsp;: <a href="mailto:...">...</a>`
- Output: Properly rendered with entities preserved

### Complex HTML Support

The solution handles:
- **Nested tags**: `<strong><a href="...">AppKiosk</a></strong>`
- **Self-closing tags**: `<br>`, `<img>`
- **Mixed content**: Text with embedded HTML elements
- **Special characters**: Unicode, em dashes, etc.

## Build Process

### Commands

- `npm run build` - Generate all locale files
- `npm run build:locales` - Same as build

### Configuration

The build script supports:
- Configurable locales (`supportedLocales` array)
- Custom output patterns (`outputPattern`)
- Default locale fallback
- Automatic locale file discovery

## Deployment Strategy

### Static File Serving

The generated files can be served statically with browser language detection:

```javascript
// Example: Serve the appropriate file based on browser language
const userLang = navigator.language || navigator.userLanguage;
const langCode = userLang.startsWith('fr') ? 'fr' : 'en';
const htmlFile = `index-${langCode}.html`;

// Or use server-side logic to serve the correct file
```

### CDN Integration

The static files are ideal for CDN deployment:
- Fast loading with pre-rendered content
- No server-side processing required
- Easy caching and global distribution

## Validation and Testing

### HTML Validation

The test suite (`test-html-validation.js`) ensures:
- ✅ No malformed tags
- ✅ No duplicate content corruption
- ✅ Proper handling of complex HTML structures
- ✅ Correct nested tag handling
- ✅ No unclosed tags (excluding self-closing tags)

### Edge Cases Tested

- Complex nested HTML with multiple levels
- Mixed content with text and HTML elements
- Special characters and HTML entities
- Missing translations (graceful handling)
- Malformed input detection

## Benefits Over Previous Approach

| Feature | Previous (inject-fallback.js) | New SSG Architecture |
|---------|------------------------------|----------------------|
| **HTML Parsing** | Regex-based (error-prone) | DOM-based (JSDOM) |
| **Content Handling** | Corrupted nested tags | Preserves all HTML structure |
| **Entity Support** | Broken entities | Proper entity handling |
| **Build Process** | Single file modification | Multiple static files |
| **Deployment** | Runtime i18n loading | Pre-rendered static content |
| **Performance** | Client-side processing | Instant loading |
| **Scalability** | Limited to one locale | Supports unlimited locales |

## Maintenance and Extensibility

### Adding New Locales

1. Create a new JSON file in `locales/` (e.g., `es.json`)
2. Add the locale to `supportedLocales` in the config
3. Run `npm run build`

### Updating Content

1. Edit the locale JSON files
2. Run the build script
3. Deploy the updated static files

### Template Changes

1. Modify `index.html` template
2. Rebuild all locales
3. All generated files are updated automatically

## Conclusion

This SSG architecture provides a robust, scalable solution for multi-locale support with complex HTML content. By using proper DOM parsing and static site generation, it eliminates the HTML corruption issues of the previous approach while providing better performance, maintainability, and deployment flexibility.