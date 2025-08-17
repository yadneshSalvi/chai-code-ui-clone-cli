#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

const readline = require('readline');
const { sendMessageToOpenAI, streamMessageToOpenAI } = require('./ai_service');

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
  
  // Send to OpenAI and stream response
  (async () => {
    try {
      process.stdout.write('AI: ');
      
      let hasContent = false;
      for await (const chunk of streamMessageToOpenAI(userInput)) {
        process.stdout.write(chunk);
        hasContent = true;
      }
      
      if (!hasContent) {
        process.stdout.write('[empty response]');
      }
      
      console.log(); // New line after streaming
      rl.prompt();
    } catch (err) {
      console.error(`\nAI Error: ${err.message}`);
      rl.prompt();
    }
  })();
  
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