# UI Task: UI001 - List User's Tasks

## 1. Objective
To enhance the user interface by displaying the tasks associated with the currently authenticated user. This feature will allow users to view their existing to-do items and mark them as complete.

## 2. Functional Requirements

### 2.1. Fetch and Display Tasks
- Upon successful login and authentication, the application must automatically fetch and display the list of tasks for that user from the backend.
- The tasks should be presented in a clear, vertical list format.
- If the user has no tasks, a user-friendly message such as "You have no tasks yet." should be displayed.

### 2.2. Task Item Display
- Each task in the list must be displayed with its text content.
- A checkbox shall be displayed to the left of each task's text.

### 2.3. Mark Task as Complete
- The user must be able to click the checkbox to mark a task as complete.
- When a task is marked as complete, its visual appearance should change to indicate its status (e.g., the text becomes struck-through, and the checkbox becomes checked).
- This action should trigger an update in the backend to persist the "completed" state of the task.

## 3. Technical Considerations
- **API Calls:**
    - Implement a `GET` or `QUERY` operation to retrieve all tasks associated with the user's `userId`.
    - Implement an `UPDATE` operation to modify a task's `completed` status in DynamoDB.
- **State Management:**
    - The UI component's state must hold the array of tasks fetched from the backend.
    - The state must be updated to reflect any changes, such as a task being marked as complete.
