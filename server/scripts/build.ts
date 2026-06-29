import { execSync } from 'node:child_process';
import { chdir } from 'node:process';

try {
  execSync('npm install', { stdio: 'inherit' });
  chdir('client');
  execSync('npm install', { stdio: 'inherit' });
  execSync('npm run build', { stdio: 'inherit' });
} catch (error) {
  console.error('Error during build process:', error);
  process.exit(1);
}
