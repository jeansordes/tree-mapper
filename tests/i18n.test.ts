import { moment } from 'obsidian';
import { getCurrentLocale, t, addTranslation, translations } from '../src/i18n';
import en from '../src/i18n/en';
import fr from '../src/i18n/fr';

describe('i18n', () => {
    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();
        
        // Mock moment.locale to return English by default
        jest.spyOn(moment, 'locale').mockImplementation(() => 'en');
        
        // Reset translations to original state
        Object.keys(translations).forEach(key => {
            if (key !== 'en' && key !== 'fr') {
                delete translations[key];
            }
        });
    });

    describe('getCurrentLocale', () => {
        it('should return the current locale if supported', () => {
            jest.spyOn(moment, 'locale').mockImplementation(() => 'fr');
            expect(getCurrentLocale()).toBe('fr');
        });

        it('should fall back to English for unsupported locales', () => {
            jest.spyOn(moment, 'locale').mockImplementation(() => 'de');
            expect(getCurrentLocale()).toBe('en');
        });

        it('should handle empty or invalid locales', () => {
            jest.spyOn(moment, 'locale').mockImplementation(() => '');
            expect(getCurrentLocale()).toBe('en');
        });
    });

    describe('t (translate)', () => {
        it('should translate keys in English', () => {
            jest.spyOn(moment, 'locale').mockImplementation(() => 'en');
            expect(t('untitledPath')).toBe(en.untitledPath);
        });

        it('should translate keys in French', () => {
            jest.spyOn(moment, 'locale').mockImplementation(() => 'fr');
            expect(t('untitledPath')).toBe(fr.untitledPath);
        });

        it('should fall back to English for missing translations', () => {
            jest.spyOn(moment, 'locale').mockImplementation(() => 'fr');
            const key = 'nonexistentKey';
            expect(t(key)).toBe(key);
        });

        it('should handle variable replacements', () => {
            jest.spyOn(moment, 'locale').mockImplementation(() => 'en');
            expect(t('noticeCreatedNote', { path: 'test.md' }))
                .toBe(en.noticeCreatedNote.replace('{{path}}', 'test.md'));
        });

        it('should handle multiple variable replacements', () => {
            addTranslation('test', {
                testKey: 'Hello {{name}}, welcome to {{place}}!'
            });
            jest.spyOn(moment, 'locale').mockImplementation(() => 'test');
            
            expect(t('testKey', { name: 'John', place: 'Paris' }))
                .toBe('Hello John, welcome to Paris!');
        });

        it('should handle missing variables', () => {
            addTranslation('test', {
                testKey: 'Hello {{name}}!'
            });
            jest.spyOn(moment, 'locale').mockImplementation(() => 'test');
            
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

            jest.spyOn(moment, 'locale').mockImplementation(() => 'es');
            expect(t('hello')).toBe('Hola');
            expect(t('goodbye')).toBe('Adiós');
        });

        it('should override existing translations', () => {
            const newTranslations = {
                untitledPath: 'sans-titre'
            };
            addTranslation('fr', newTranslations);

            jest.spyOn(moment, 'locale').mockImplementation(() => 'fr');
            expect(t('untitledPath')).toBe('sans-titre');
        });
    });
}); 