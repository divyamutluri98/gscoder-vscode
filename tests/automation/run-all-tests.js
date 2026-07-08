const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting GSCODER Test Automation Suite...\n');

async function runCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    console.log(`\n📋 Running: ${command} ${args.join(' ')}`);
    
    const process = spawn(command, args, { cwd, shell: true });
    
    process.stdout.on('data', (data) => {
      console.log(data.toString());
    });
    
    process.stderr.on('data', (data) => {
      console.error(data.toString());
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${command} completed successfully`);
        resolve();
      } else {
        console.error(`❌ ${command} failed with code ${code}`);
        reject(new Error(`${command} failed`));
      }
    });
  });
}

async function main() {
  const projectRoot = path.resolve(__dirname, '../..');
  
  try {
    // Step 1: Type checking
    console.log('\n🔍 Step 1: Type Checking');
    await runCommand('npm', ['run', 'typecheck'], projectRoot);
    
    // Step 2: Linting
    console.log('\n🔍 Step 2: Linting');
    await runCommand('npm', ['run', 'lint'], projectRoot);
    
    // Step 3: Build
    console.log('\n🔨 Step 3: Building');
    await runCommand('npm', ['run', 'build'], projectRoot);
    
    // Step 4: Start server
    console.log('\n🌐 Step 4: Starting Test Server');
    const server = spawn('node', ['server.js'], { cwd: projectRoot, shell: true });
    
    server.stdout.on('data', (data) => {
      console.log(`Server: ${data.toString()}`);
    });
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Step 5: Playwright tests
    console.log('\n🎭 Step 5: Running Playwright Tests');
    await runCommand('npx', ['playwright', 'test'], projectRoot);
    
    // Step 6: Selenium tests
    console.log('\n🤖 Step 6: Running Selenium Tests');
    await runCommand('node', ['tests/selenium/test.js'], projectRoot);
    
    // Cleanup
    console.log('\n🧹 Cleaning up...');
    server.kill();
    
    console.log('\n✨ All tests completed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('  ✅ Type Checking: PASSED');
    console.log('  ✅ Linting: PASSED');
    console.log('  ✅ Build: PASSED');
    console.log('  ✅ Playwright Tests: PASSED');
    console.log('  ✅ Selenium Tests: PASSED');
    
  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

main();
