/**
 * Light/dark theme shared by the header navigation and the home page hero.
 * The initial class is set by the inline script in app.vue before paint;
 * this keeps the reactive state in sync with it.
 */
export function useTheme() {
  const isDark = useState('theme-dark', () => true);

  if (import.meta.client) {
    const saved = localStorage.getItem('theme');
    isDark.value = saved ? saved === 'dark' : true;
    document.documentElement.classList.toggle('dark', isDark.value);
  }

  function toggleTheme() {
    isDark.value = !isDark.value;
    if (import.meta.client) {
      document.documentElement.classList.toggle('dark', isDark.value);
      localStorage.setItem('theme', isDark.value ? 'dark' : 'light');
    }
  }

  return { isDark, toggleTheme };
}
