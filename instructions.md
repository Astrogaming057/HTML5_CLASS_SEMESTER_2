# AI Instructions for HTMLCLASS Project

## Code Style & Organization
### Comments
- **Avoid leaving comments in code** - Code should be self-documenting through clear naming and structure
- Only add comments when absolutely necessary for complex logic that cannot be made clearer through refactoring

### File Organization
- **Break code into many files and subfolders for easy maintainability**
- Keep files focused on a single responsibility
- Group related functionality into logical modules
- Use descriptive file and folder names that clearly indicate their purpose
- Separate concerns: routes, utilities, middleware, handlers, etc. should be in their own files/folders
- **NEVER embed large blocks of CSS, HTML, or complex logic directly in route files**
- Extract CSS to separate files in `templates/css/` directory
- Extract complex processing logic to utility modules in `utils/` directory
- Route files should be thin and delegate to specialized modules
- If a file is getting long (50+ lines of embedded content/logic), extract it to a separate module

### Code Structure
- Use meaningful variable and function names that describe their purpose
- Keep functions small and focused on a single task
- Prefer composition over large monolithic files
- Extract reusable logic into utility modules
- Use consistent naming conventions (camelCase for variables/functions, PascalCase for classes)

### Project-Specific Guidelines
- Maintain the existing server structure (routes, middleware, utils, watcher, websocket)
- Follow the existing patterns for template organization (css, html, js subfolders)
- Keep assignment folders organized by week structure
- Ensure all file paths use proper path utilities (use pathUtils.js when available)

### Error Handling
- Implement proper error handling for all async operations
- Use try-catch blocks where appropriate
- Provide meaningful error messages without exposing sensitive information

### Performance
- Avoid blocking operations in the main thread
- Use async/await for asynchronous operations
- Optimize file operations and avoid unnecessary file system access

### Security
- Validate and sanitize all user inputs
- Use secure file path handling to prevent directory traversal
- Avoid exposing sensitive information in error messages or logs

### Testing & Quality
- Write testable code with clear separation of concerns
- Ensure code is maintainable and easy to understand
- Follow DRY (Don't Repeat Yourself) principles


When prompted by the user "Follow aditional rules in: ai_instructions.md"