
#!/usr/bin/env node

// Simple test to verify the focus service logic
console.log('Testing Focus Service Logic Fix');
console.log('================================');

class MockFocusService {
    constructor() {
        this.focusTarget = null;
        this.ticketsLoading = false;
        this.pullRequestsLoading = false;
        this.tickets = [];
        this.pullRequests = [];
        this.todos = [];
        this.ideas = [];
    }

    setFocus(target) {
        this.focusTarget = target;
        console.log(`✓ Focus set to: ${JSON.stringify(target)}`);
    }

    clearFocus() {
        this.focusTarget = null;
        console.log('✓ Focus cleared');
    }

    focusedItem() {
        if (!this.focusTarget) return null;
        return this._resolve(this.focusTarget);
    }

    checkFocusValidity() {
        console.log(`  Current focus: ${JSON.stringify(this.focusTarget)}`);
        console.log(`  Focused item: ${this.focusedItem() ? 'found' : 'not found'}`);
        console.log(`  Tickets loading: ${this.ticketsLoading}`);
        console.log(`  PRs loading: ${this.pullRequestsLoading}`);

        if (this.focusTarget && !this.focusedItem()) {
            const dataLoaded = this._isDataLoadedForTarget(this.focusTarget);
            console.log(`  Data loaded for target: ${dataLoaded}`);

            if (dataLoaded) {
                this.clearFocus();
                return 'Focus cleared - data loaded but item not found';
            } else {
                return 'Focus preserved - data still loading';
            }
        }
        return 'Focus valid';
    }

    _resolve(target) {
        switch (target.type) {
            case 'ticket':
                return this.tickets.find(t => t.id === target.id) || null;
            case 'pr':
                return this.pullRequests.find(p => p.id === target.id) || null;
            case 'todo':
                return this.todos.find(t => t.id === target.id) || null;
            case 'idea':
                return this.ideas.find(i => i.id === target.id) || null;
        }
        return null;
    }

    _isDataLoadedForTarget(target) {
        switch (target.type) {
            case 'ticket':
                return !this.ticketsLoading;
            case 'pr':
                return !this.pullRequestsLoading;
            case 'todo':
            case 'idea':
                return true; // Always available
        }
        return true;
    }
}

function runTest(testName, testFn) {
    console.log(`\n🧪 ${testName}`);
    console.log('------------------------------');
    try {
        testFn();
        console.log('✅ PASS');
    } catch (error) {
        console.log(`❌ FAIL: ${error.message}`);
    }
}

function testFocusPreservedDuringLoading() {
    const service = new MockFocusService();

    // Setup: User sets focus on a ticket
    service.tickets = [{ id: 'tk-1', type: 'ticket', title: 'Test Ticket' }];
    service.setFocus({ id: 'tk-1', type: 'ticket' });

    // Simulate page refresh - data not loaded yet
    service.tickets = [];
    service.ticketsLoading = true;

    const result = service.checkFocusValidity();

    if (result !== 'Focus preserved - data still loading') {
        throw new Error(`Expected "Focus preserved - data still loading", got "${result}"`);
    }

    if (service.focusTarget === null) {
        throw new Error('Focus should not be null when data is still loading');
    }
}

function testFocusClearedWhenItemMissing() {
    const service = new MockFocusService();

    // Setup: User sets focus on a ticket
    service.tickets = [{ id: 'tk-1', type: 'ticket', title: 'Test Ticket' }];
    service.setFocus({ id: 'tk-1', type: 'ticket' });

    // Data loads but ticket is gone
    service.tickets = [];
    service.ticketsLoading = false;

    const result = service.checkFocusValidity();

    if (result !== 'Focus cleared - data loaded but item not found') {
        throw new Error(`Expected "Focus cleared - data loaded but item not found", got "${result}"`);
    }

    if (service.focusTarget !== null) {
        throw new Error('Focus should be null when data is loaded but item doesn\'t exist');
    }
}

function testTodoFocusAlwaysPreserved() {
    const service = new MockFocusService();

    // Setup: User sets focus on a todo
    service.todos = [{ id: 'td-1', type: 'todo', title: 'Test Todo' }];
    service.setFocus({ id: 'td-1', type: 'todo' });

    // Todos are cleared (but no loading state for todos)
    service.todos = [];

    const result = service.checkFocusValidity();

    if (result !== 'Focus cleared - data loaded but item not found') {
        throw new Error(`Expected "Focus cleared - data loaded but item not found", got "${result}"`);
    }

    if (service.focusTarget !== null) {
        throw new Error('Focus should be null when todo doesn\'t exist');
    }
}

// Run all tests
runTest('Focus preserved during data loading', testFocusPreservedDuringLoading);
runTest('Focus cleared when item missing after loading', testFocusClearedWhenItemMissing);
runTest('Todo focus cleared when item missing', testTodoFocusAlwaysPreserved);

console.log('\n🎉 All tests completed!');
