// Dark is the default look. Apply the saved theme before first paint to avoid a flash.
var t = null
try { t = JSON.parse(localStorage.getItem('tt.theme')) } catch (e) {}
if (t !== 'light') document.documentElement.classList.add('dark')
