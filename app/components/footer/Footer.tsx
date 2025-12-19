export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="flex items-center justify-center p-5 border-t h-[var(--header-height)]"
      style={{ background: 'linear-gradient(to right, #342644 0%, #f3ebfdff 50%, #342644 100%)' }}
    >
      <div className="text-center text-black">
        <span>© {currentYear} </span>
        <a 
          href="http://bestbuilder.dev/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="hover:underline font-semibold"
        >
          Bestbuilder.dev
        </a>
      </div>
    </footer>
  );
}
