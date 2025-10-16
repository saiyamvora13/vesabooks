import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const languages = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'zh', name: '中文' },
];

export default function LanguageSwitcher({ testId = "language-switcher" }: { testId?: string }) {
  const { i18n } = useTranslation();

  const currentLanguage = languages.find(lang => 
    i18n.language.startsWith(lang.code)
  ) || languages[0];

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
  };

  return (
    <Select value={currentLanguage.code} onValueChange={handleLanguageChange}>
      <SelectTrigger 
        className="w-[140px] h-9 border-border/50 hover:border-border transition-colors pl-3"
        data-testid={testId}
      >
        <span className="mr-2">🌐</span>
        <SelectValue placeholder={currentLanguage.name} />
      </SelectTrigger>
      <SelectContent>
        {languages.map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            {lang.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
