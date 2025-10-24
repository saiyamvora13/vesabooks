import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-foreground/70">🌐</span>
      <Select value={currentLangCode} onValueChange={handleLanguageChange}>
        <SelectTrigger className="h-9 w-[130px] text-sm" data-testid={testId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {languages.map((lang) => (
            <SelectItem key={lang.code} value={lang.code}>
              {lang.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
