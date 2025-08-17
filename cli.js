#!/usr/bin/env node

const readline = require('readline');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'You: '
});

console.log('🍵 Chai CLI Chat - Type "exit" to quit');
console.log('----------------------------------------');

// Display prompt
rl.prompt();

// Handle user input
rl.on('line', (input) => {
  const userInput = input.trim();
  
  // Exit condition
  if (userInput.toLowerCase() === 'exit') {
    console.log('Goodbye! 👋');
    rl.close();
    return;
  }
  
  // For now, always respond with "Hello, World!"
  console.log('AI: Hello, World!');
  
  // Show prompt again for next input
  rl.prompt();
});

// Handle Ctrl+C
rl.on('SIGINT', () => {
  console.log('\nGoodbye! 👋');
  process.exit(0);
});

// Handle when readline is closed
rl.on('close', () => {
  process.exit(0);
});