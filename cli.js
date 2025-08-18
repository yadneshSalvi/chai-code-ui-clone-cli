#!/usr/bin/env node

import dotenv from 'dotenv';
import readline from 'readline';
import { WebsiteCloneAgent } from './agent/agent.js';

dotenv.config({ path: '.env.local' });

// Create agent instance (keeps session history in memory)
const agent = new WebsiteCloneAgent({
  model: process.env.OPENAI_MODEL || 'gpt-4.1',
  maxSteps: 20
});

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
  
  // Use the agent (no streaming). Agent logs reasoning/tool calls and final JSON.
  (async () => {
    try {
      console.log('AI: Working...');
      const result = await agent.run(userInput);
      if (!result.final) {
        console.log('AI: No final result yet (max steps reached).');
      }
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