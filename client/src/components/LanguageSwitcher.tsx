import { useTranslation } from 'react-i18next';

const languages = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'zh', name: '中文' },
];

export default function LanguageSwitcher({ testId = "language-switcher" }: { testId?: string }) {
  const { i18n } = useTranslation();
  
  // Use 'en' as fallback if language isn't in our list (e.g., 'en-US' -> 'en')
  const currentLangCode = languages.find(l => l.code === i18n.language)?.code || 
                          languages.find(l => i18n.language.startsWith(l.code))?.code || 
                          'en';

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    i18n.changeLanguage(e.target.value);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-foreground/70">🌐</span>
      <select 
        value={currentLangCode} 
        onChange={handleLanguageChange}
        className="h-9 w-[100px] px-3 py-1 text-sm rounded-md border border-border/50 hover:border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer transition-colors"
        data-testid={testId}
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
}
