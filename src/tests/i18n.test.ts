import { moment } from 'obsidian';
import { getCurrentLocale, t, addTranslation, translations } from '../i18n';
import en from '../i18n/en';
import fr from '../i18n/fr';

// Mock moment.locale()
jest.mock('obsidian', () => ({
    moment: {
        locale: jest.fn()
    }
}));

describe('i18n', () => {
    beforeEach(() => {
        // Reset moment.locale mock
        (moment.locale as jest.Mock).mockReset();
        // Reset translations to original state
        Object.keys(translations).forEach(key => {
            if (key !== 'en' && key !== 'fr') {
                delete translations[key];
            }
        });
    });

    describe('getCurrentLocale', () => {
        it('should return the current locale if supported', () => {
            (moment.locale as jest.Mock).mockReturnValue('fr');
            expect(getCurrentLocale()).toBe('fr');
        });

        it('should fall back to English for unsupported locales', () => {
            (moment.locale as jest.Mock).mockReturnValue('de');
            expect(getCurrentLocale()).toBe('en');
        });

        it('should handle empty or invalid locales', () => {
            (moment.locale as jest.Mock).mockReturnValue('');
            expect(getCurrentLocale()).toBe('en');

            (moment.locale as jest.Mock).mockReturnValue(undefined);
            expect(getCurrentLocale()).toBe('en');
        });
    });

    describe('t (translate)', () => {
        it('should translate keys in English', () => {
            (moment.locale as jest.Mock).mockReturnValue('en');
            expect(t('untitledPath')).toBe(en.untitledPath);
        });

        it('should translate keys in French', () => {
            (moment.locale as jest.Mock).mockReturnValue('fr');
            expect(t('untitledPath')).toBe(fr.untitledPath);
        });

        it('should fall back to English for missing translations', () => {
            (moment.locale as jest.Mock).mockReturnValue('fr');
            const key = 'nonexistentKey';
            expect(t(key)).toBe(key);
        });

        it('should handle variable replacements', () => {
            (moment.locale as jest.Mock).mockReturnValue('en');
            expect(t('noticeCreatedNote', { path: 'test.md' }))
                .toBe(en.noticeCreatedNote.replace('{{path}}', 'test.md'));
        });

        it('should handle multiple variable replacements', () => {
            addTranslation('test', {
                testKey: 'Hello {{name}}, welcome to {{place}}!'
            });
            (moment.locale as jest.Mock).mockReturnValue('test');
            
            expect(t('testKey', { name: 'John', place: 'Paris' }))
                .toBe('Hello John, welcome to Paris!');
        });

        it('should handle missing variables', () => {
            addTranslation('test', {
                testKey: 'Hello {{name}}!'
            });
            (moment.locale as jest.Mock).mockReturnValue('test');
            
            expect(t('testKey')).toBe('Hello {{name}}!');
        });
    });

    describe('addTranslation', () => {
        it('should add new translations', () => {
            const newTranslations = {
                hello: 'Hola',
                goodbye: 'Adiós'
            };
            addTranslation('es', newTranslations);

            (moment.locale as jest.Mock).mockReturnValue('es');
            expect(t('hello')).toBe('Hola');
            expect(t('goodbye')).toBe('Adiós');
        });

        it('should override existing translations', () => {
            const newTranslations = {
                untitledPath: 'sans-titre'
            };
            addTranslation('fr', newTranslations);

            (moment.locale as jest.Mock).mockReturnValue('fr');
            expect(t('untitledPath')).toBe('sans-titre');
        });
    });
}); 