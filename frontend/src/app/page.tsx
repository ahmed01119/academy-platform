/**
 * The site's front door is the landing page. Signed-in visitors see a "go to my dashboard" button there
 * (the landing reads the session), so nobody is sent to the login page just for opening the site.
 */
export { default } from './landing/page';
