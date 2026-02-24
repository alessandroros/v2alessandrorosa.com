# Blog Post Creator Helper
# Usage: .\create-blog-post.ps1 "My Blog Post Title"

param(
    [Parameter(Mandatory=$true)]
    [string]$Title
)

# Convert title to URL-friendly slug
$slug = $Title.ToLower() -replace '[^a-z0-9\s-]', '' -replace '\s+', '-'

# Get current date in ISO 8601 format
$currentDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

# Create the file path
$filePath = "content\blog\$slug.md"

# Check if file already exists
if (Test-Path $filePath) {
    Write-Host "Error: A blog post with this title already exists at $filePath" -ForegroundColor Red
    exit 1
}

# Create the content
$content = @"
---
title: $Title
date_created: $currentDate
date_modified: $currentDate
description: A brief description of your post
---

## Introduction

Write your introduction here...

## Main Content

Your main content goes here.

## Conclusion

Wrap up your post here.
"@

# Write the file
$content | Out-File -FilePath $filePath -Encoding UTF8

Write-Host "✓ Blog post created successfully!" -ForegroundColor Green
Write-Host "  File: $filePath" -ForegroundColor Cyan
Write-Host "  URL: /blog/$slug" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Edit the content in $filePath"
Write-Host "  2. Add images to /public/blog/ if needed"
Write-Host "  3. Update nuxt.config.ts prerender routes with: '/blog/$slug'"
Write-Host "  4. Run npm run dev to preview your post"


