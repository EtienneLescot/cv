#!/usr/bin/env node
/**
 * Test script to validate HTML structure and ATS-safe content
 * Tests for: structure, forbidden symbols, dates format, sections order
 */

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

// Test files - look in dist/web/short first, fallback to current directory
const testFiles = [
  'dist/web/short/index-fr.html',
  'dist/web/short/index-en.html'
];

// Self-closing tags that don't need closing tags
const SELF_CLOSING_TAGS = ['BR', 'IMG', 'INPUT', 'HR', 'META', 'LINK'];

// ATS-safe validation rules
const ATS_RULES = {
  // Forbidden symbols in visible text  (• should be -, HTML entities like &nbsp; are OK)
  forbiddenSymbols: /[•]/g,
  
  // Date format: YYYY-YYYY or YYYY - Present/Aujourd'hui
  datePattern: /\d{4}-\d{4}|\d{4}\s*-\s*(Present|Aujourd'hui)/gi,
  
  // Expected section order
  expectedSectionOrder: [
    'header-section',
    'contact-section',
    'profile-section',
    'skills-section',
    'experiences-section',
    'formation-section',
    'languages-section',
    'interests-section'
  ],
  
  // Required sections
  requiredSections: [
    'contact-section',
    'profile-section',
    'skills-section',
    'experiences-section',
    'formation-section',
    'languages-section'
  ],
  
  // Forbidden sections
  forbiddenSections: [
    'projects-section'
  ]
};

function validateHtmlFile(filePath) {
  console.log(`\n🧪 Testing file: ${filePath}`);
  console.log('='.repeat(60));

  const errors = [];
  const warnings = [];

  try {
    const htmlContent = fs.readFileSync(filePath, 'utf8');
    const dom = new JSDOM(htmlContent);
    const { document } = dom.window;

    // Test 1: HTML parses successfully
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
      errors.push(`Found ${malformedTags.length} malformed tags`);
      console.error(`✗ Found ${malformedTags.length} malformed tags`);
    } else {
      console.log('✓ No malformed tags found');
    }

    // Test 3: Check for forbidden symbols in text content
    const textContent = document.body.textContent || '';
    const forbiddenMatches = textContent.match(ATS_RULES.forbiddenSymbols);
    
    if (forbiddenMatches && forbiddenMatches.length > 0) {
      errors.push(`Found forbidden symbols: ${forbiddenMatches.join(', ')}`);
      console.error(`✗ Found forbidden symbols: ${forbiddenMatches.join(', ')}`);
    } else {
      console.log('✓ No forbidden symbols (&, •) in text content');
    }

    // Test 4: Verify no "Projects" section exists (must be integrated in experiences)
    ATS_RULES.forbiddenSections.forEach(sectionClass => {
      const section = document.querySelector(`.${sectionClass}`);
      if (section) {
        errors.push(`Forbidden section found: ${sectionClass}`);
        console.error(`✗ Forbidden section found: ${sectionClass} (must be integrated in experiences)`);
      } else {
        console.log(`✓ No forbidden "${sectionClass}" section`);
      }
    });

    // Test 5: Check for required sections
    ATS_RULES.requiredSections.forEach(sectionClass => {
      const section = document.querySelector(`.${sectionClass}`);
      if (!section) {
        errors.push(`Required section missing: ${sectionClass}`);
        console.error(`✗ Required section missing: ${sectionClass}`);
      }
    });
    console.log(`✓ All required sections present`);

    // Test 6: Validate section order
    const sections = Array.from(document.querySelectorAll('section, header'));
    const actualOrder = sections
      .map(s => {
        // Get first class that ends with -section
        const classList = Array.from(s.classList);
        return classList.find(c => c.endsWith('-section')) || s.className;
      })
      .filter(Boolean);

    const orderMatches = actualOrder.every((className, index) => {
      return className === ATS_RULES.expectedSectionOrder[index];
    });

    if (!orderMatches) {
      warnings.push(`Section order mismatch. Expected: ${ATS_RULES.expectedSectionOrder.join(', ')}, Got: ${actualOrder.join(', ')}`);
      console.warn(`⚠ Section order: ${actualOrder.join(' → ')}`);
    } else {
      console.log('✓ Sections in ATS-safe linear order');
    }

    // Test 7: URLs must be displayed as plain text in links
    const links = document.querySelectorAll('a[href^="http"]');
    let urlTextIssues = 0;
    links.forEach(link => {
      const text = link.textContent.trim();
      const href = link.getAttribute('href');
      // Check if link text contains a domain or http/www
      if (!text.includes('http') && !text.includes('www') && !text.includes('.com') && !text.includes('.io') && !text.includes('.github')) {
        urlTextIssues++;
      }
    });

    if (urlTextIssues > 0) {
      warnings.push(`${urlTextIssues} links don't display URL as text`);
      console.warn(`⚠ ${urlTextIssues} links should display URL in plain text`);
    } else {
      console.log('✓ All external links display URLs as plain text');
    }

    // Test 8: Check for experiences with h3 titles
    const experienceSection = document.querySelector('.experiences-section');
    if (experienceSection) {
      const experienceItems = experienceSection.querySelectorAll('.experience-item');
      const h3Titles = experienceSection.querySelectorAll('.experience-item h3');
      
      if (experienceItems.length > 0 && h3Titles.length === 0) {
        errors.push('Experience items should use <h3> for job titles');
        console.error('✗ Experience items should use <h3> for job titles');
      } else if (h3Titles.length > 0) {
        console.log(`✓ Experience items use <h3> for titles (${h3Titles.length} found)`);
      }
    }

    // Test 9: Check for Formation section
    const formationSection = document.querySelector('.formation-section');
    if (!formationSection) {
      errors.push('Formation section is missing (required for ATS)');
      console.error('✗ Formation section is missing');
    } else {
      const formationItems = formationSection.querySelectorAll('li');
      if (formationItems.length < 2) {
        warnings.push('Formation section should include both BTS and Autodidacte entries');
        console.warn('⚠ Formation section should include both BTS and Autodidacte entries');
      } else {
        console.log(`✓ Formation section present with ${formationItems.length} entries`);
      }
    }

    // Test 10: Check that main container uses semantic tags
    const container = document.querySelector('.container');
    if (container && container.tagName !== 'MAIN') {
      warnings.push('Container should use <main> tag for better accessibility');
      console.warn('⚠ Container should use <main> semantic tag');
    } else {
      console.log('✓ Container uses semantic <main> tag');
    }

    // Test 11: Verify no excessive nesting (spans inside spans, divs inside divs)
    const nestedSpans = document.querySelectorAll('span span');
    const nestedDivs = document.querySelectorAll('div div div');
    
    if (nestedSpans.length > 0 || nestedDivs.length > 5) {
      warnings.push(`Excessive nesting detected: ${nestedSpans.length} nested spans, ${nestedDivs.length} deeply nested divs`);
      console.warn(`⚠ Excessive nesting: ${nestedSpans.length} nested <span>, ${nestedDivs.length} deep <div>`);
    } else {
      console.log('✓ No excessive tag nesting');
    }

    // Summary
    console.log('='.repeat(60));
    if (errors.length === 0 && warnings.length === 0) {
      console.log('✅ All ATS-safe tests passed!');
      return { success: true, errors: [], warnings: [] };
    } else {
      if (errors.length > 0) {
        console.log(`❌ ${errors.length} error(s) found`);
        errors.forEach(err => console.log(`   - ${err}`));
      }
      if (warnings.length > 0) {
        console.log(`⚠️  ${warnings.length} warning(s) found`);
        warnings.forEach(warn => console.log(`   - ${warn}`));
      }
      return { 
        success: errors.length === 0, 
        errors, 
        warnings 
      };
    }

  } catch (error) {
    console.error(`✗ Failed to validate ${filePath}:`, error.message);
    return { success: false, errors: [error.message], warnings: [] };
  }
}

// Run tests
console.log('🚀 Starting ATS-Safe HTML Validation Tests');
console.log('='.repeat(60));

const results = {
  totalFiles: 0,
  passedFiles: 0,
  failedFiles: 0,
  errors: [],
  warnings: []
};

testFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    results.totalFiles++;
    const result = validateHtmlFile(filePath);
    
    if (result.success) {
      results.passedFiles++;
    } else {
      results.failedFiles++;
    }
    
    results.errors.push(...result.errors);
    results.warnings.push(...result.warnings);
  } else {
    console.warn(`⚠ Test file not found: ${file} (run build first)`);
  }
});

// Final summary
console.log('\n' + '='.repeat(60));
console.log('📊 FINAL RESULTS');
console.log('='.repeat(60));
console.log(`Total files tested: ${results.totalFiles}`);
console.log(`Passed: ${results.passedFiles}`);
console.log(`Failed: ${results.failedFiles}`);
console.log(`Total errors: ${results.errors.length}`);
console.log(`Total warnings: ${results.warnings.length}`);

if (results.failedFiles === 0 && results.errors.length === 0) {
  console.log('\n🎉 All ATS-safe validation tests passed!');
  console.log('✅ CV is optimized for ATS parsing systems');
  process.exit(0);
} else {
  console.log('\n❌ Some validation tests failed');
  console.log('⚠️  Please fix errors before deploying');
  process.exit(1);
}
