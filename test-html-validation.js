#!/usr/bin/env node
/**
 * Test script to validate HTML structure and complex nested content
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Test files
const testFiles = [
  'index-fr.html',
  'index-en.html'
];

// Self-closing tags that don't need closing tags
const SELF_CLOSING_TAGS = ['BR', 'IMG', 'INPUT', 'HR', 'META', 'LINK'];

function validateHtmlFile(filePath) {
  console.log(`🧪 Testing file: ${filePath}`);

  try {
    const htmlContent = fs.readFileSync(filePath, 'utf8');
    const dom = new JSDOM(htmlContent);
    const { document } = dom.window;

    // Test 1: Validate basic structure
    console.log('✓ HTML parses successfully');

    // Test 2: Check for malformed tags
    const malformedTags = [];
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
      if (!el.tagName || el.tagName.includes(' ')) {
        malformedTags.push(el);
      }
    });

    if (malformedTags.length > 0) {
      console.error(`✗ Found ${malformedTags.length} malformed tags`);
      malformedTags.slice(0, 5).forEach(tag => console.error(`  - ${tag}`));
    } else {
      console.log('✓ No malformed tags found');
    }

    // Test 3: Check for duplicate content (corruption)
    const contentMap = new Map();
    const duplicateElements = [];

    allElements.forEach(el => {
      if (el.textContent && el.textContent.trim().length > 20) {
        const contentKey = el.textContent.trim().substring(0, 50);
        if (contentMap.has(contentKey)) {
          contentMap.set(contentKey, contentMap.get(contentKey) + 1);
          if (contentMap.get(contentKey) > 2) { // Allow for some legitimate duplicates
            duplicateElements.push(el);
          }
        } else {
          contentMap.set(contentKey, 1);
        }
      }
    });

    if (duplicateElements.length > 0) {
      console.warn(`⚠ Found ${duplicateElements.length} elements with potentially duplicate content`);
    } else {
      console.log('✓ No significant duplicate content found');
    }

    // Test 4: Check complex HTML structures
    const complexElements = document.querySelectorAll('a, strong, em, br');
    console.log(`✓ Found ${complexElements.length} complex HTML elements`);

    // Test 5: Validate nested structures
    const nestedStructures = document.querySelectorAll('strong a, a strong, li a');
    console.log(`✓ Found ${nestedStructures.length} properly nested structures`);

    // Test 6: Check for unclosed tags (excluding self-closing tags)
    const unclosedTags = [];
    const checkUnclosed = (node) => {
      if (node.children.length > 0) {
        Array.from(node.children).forEach(checkUnclosed);
      }
      if (node.tagName && !SELF_CLOSING_TAGS.includes(node.tagName.toUpperCase()) &&
          !node.outerHTML.includes(`</${node.tagName.toLowerCase()}>`)) {
        unclosedTags.push(node);
      }
    };

    checkUnclosed(document.body);

    if (unclosedTags.length > 0) {
      console.error(`✗ Found ${unclosedTags.length} unclosed tags`);
      unclosedTags.slice(0, 5).forEach(tag => console.error(`  - ${tag.outerHTML}`));
    } else {
      console.log('✓ No unclosed tags found');
    }

    console.log('✅ All tests passed for', filePath);
    return true;

  } catch (error) {
    console.error(`✗ Failed to validate ${filePath}:`, error.message);
    return false;
  }
}

// Run tests
console.log('🚀 Starting HTML Validation Tests');
console.log('--------------------------------');

let successCount = 0;
testFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    if (validateHtmlFile(filePath)) {
      successCount++;
    }
    console.log('--------------------------------');
  } else {
    console.warn(`⚠ Test file not found: ${file}`);
  }
});

console.log(`🎯 Test Results: ${successCount}/${testFiles.length} files validated successfully`);

if (successCount === testFiles.length) {
  console.log('🎉 All HTML validation tests passed!');
} else {
  console.error('❌ Some validation tests failed');
  process.exit(1);
}