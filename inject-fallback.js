const fs = require('fs');
const path = require('path');

// Read the HTML file
const htmlPath = path.join(__dirname, 'index.html');
let htmlContent = fs.readFileSync(htmlPath, 'utf8');

// Read the fallback data
const fallbackPath = path.join(__dirname, 'locales/fr.json');
const fallbackData = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));

// Function to inject fallback data into elements with data-i18n attributes
function injectFallbackData(html, data) {
  // Match all elements with data-i18n attributes
  const i18nRegex = /<([^>]+)\s+data-i18n="([^"]+)"[^>]*>(.*?)<\/([^>]+)>/gs;

  // Replace content with fallback data
  return html.replace(i18nRegex, (match, p1, key, content, p4) => {
    // Skip if it's a self-closing tag
    if (match.endsWith('/>')) return match;

    // Get the fallback content
    const fallbackContent = data[key] || '';

    // Return the element with fallback content
    // Check if the content already contains anchor tags to avoid duplication
    if (content.includes('<a') && fallbackContent.includes('<a')) {
        return `<${p1} data-i18n="${key}">${content}</${p4}>`;
    }
    return `<${p1} data-i18n="${key}">${fallbackContent}</${p4}>`;
  });
}

// Inject the fallback data
const updatedHtml = injectFallbackData(htmlContent, fallbackData);

// Write the updated HTML back to the file
fs.writeFileSync(htmlPath, updatedHtml, 'utf8');

console.log('Fallback data injected successfully!');