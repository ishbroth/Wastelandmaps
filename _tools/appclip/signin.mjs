// Signs the recording profile in, off camera (the email is never on the video).   node _tools/appclip/signin.mjs <email> <four digits>
import { launch, sleep } from './harness.mjs';
const [,, email, digits] = process.argv;
const b = await launch({});
try {
  await b.goto('http://localhost:5173/?q=Boston&look=pipboy', 9000);
  await b.ev('localStorage.clear(); sessionStorage.clear()'); await b.goto('http://localhost:5173/?q=Boston&look=pipboy', 8000);
  await b.shot(process.env.TEMP + '/signin-0.png');
  await b.clickText('sign in');
  await sleep(1500);
  await b.type('input[type=email]', email);
  await b.type('input[inputmode=numeric]', digits);
  await sleep(300);
  await b.shot(process.env.TEMP + '/signin-form.png');
  await b.clickText('sign in', { tag: 'button[type=submit]' });
  await sleep(12000);
  await b.shot(process.env.TEMP + '/signin-after.png');
  console.log('after sign-in the page says:', (await b.ev('document.body.innerText.slice(0, 300)')).split(String.fromCharCode(10)).join(' | '));
} finally { b.close(); }
