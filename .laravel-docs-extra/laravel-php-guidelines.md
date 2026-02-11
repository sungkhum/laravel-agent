---
name: php-guidelines-from-spatie
description: Describes PHP and Laravel guidelines provided by Spatie. These rules result in more maintainable, and readable code.
license: MIT
metadata:
   author: Spatie
   tags: php, laravel, best practices, coding standards
---

## Core Laravel Principle

**Follow Laravel conventions first.** If Laravel has a documented way to do something, use it. Only deviate when you have a clear justification.

## PHP Standards

- Follow PSR-1, PSR-2, and PSR-12
- Use camelCase for non-public-facing strings
- Use short nullable notation: `?string` not `string|null`
- Always specify `void` return types when methods return nothing

## Class Structure
- Use typed properties, not docblocks:
- Constructor property promotion when all properties can be promoted:
- One trait per line:

## Type Declarations & Docblocks
- Use typed properties over docblocks
- Specify return types including `void`
- Use short nullable syntax: `?Type` not `Type|null`
- Document iterables with generics:
  ```php
  /** @return Collection<int, User> */
  public function getUsers(): Collection
  ```

### Docblock Rules
- Don't use docblocks for fully type-hinted methods (unless description needed)
- **Always import classnames in docblocks** - never use fully qualified names:
  ```php
  use \Spatie\Url\Url;
  /** @return Url */
  ```
- Use one-line docblocks when possible: `/** @var string */`
- Most common type should be first in multi-type docblocks:
  ```php
  /** @var Collection|SomeWeirdVendor\Collection */
  ```
- If one parameter needs docblock, add docblocks for all parameters
- For iterables, always specify key and value types:
  ```php
  /**
   * @param array<int, MyObject> $myArray
   * @param int $typedArgument 
   */
  function someFunction(array $myArray, int $typedArgument) {}
  ```
- Use array shape notation for fixed keys, put each key on it's own line:
  ```php
  /** @return array{
     first: SomeClass, 
     second: SomeClass
  } */
  ```

## Control Flow
- **Happy path last**: Handle error conditions first, success case last
- **Avoid else**: Use early returns instead of nested conditions
- **Separate conditions**: Prefer multiple if statements over compound conditions
- **Always use curly brackets** even for single statements
- **Ternary operators**: Each part on own line unless very short

```php
// Happy path last
if (! $user) {
    return null;
}

if (! $user->isActive()) {
    return null;
}

// Process active user...

// Short ternary
$name = $isFoo ? 'foo' : 'bar';

// Multi-line ternary
$result = $object instanceof Model ?
    $object->name :
    'A default value';

// Ternary instead of else
$condition
    ? $this->doSomething()
    : $this->doSomethingElse();
```

## Laravel Conventions

### Routes
- URLs: kebab-case (`/open-source`)
- Route names: camelCase (`->name('openSource')`)
- Parameters: camelCase (`{userId}`)
- Use tuple notation: `[Controller::class, 'method']`

> **Laravel 8 caveat:** Tuple route syntax (`[Controller::class, 'method']`) is supported in Laravel 8 but is not the default in generated stubs or documentation. You may encounter string-based routing (`'PostsController@index'`) in existing code. Prefer tuple notation for new code, but be aware that the `$namespace` property on `RouteServiceProvider` is still present by default in Laravel 8 and affects string-based route resolution.

### Controllers
- Plural resource names (`PostsController`)
- Stick to CRUD methods (`index`, `create`, `store`, `show`, `edit`, `update`, `destroy`)
- Extract new controllers for non-CRUD actions

### Configuration
- Files: kebab-case (`pdf-generator.php`)
- Keys: snake_case (`chrome_path`)
- Add service configs to `config/services.php`, don't create new files
- Use `config()` helper, avoid `env()` outside config files

### Artisan Commands
- Names: kebab-case (`delete-old-records`)
- Always provide feedback (`$this->comment('All ok!')`)
- Show progress for loops, summary at end
- Put output BEFORE processing item (easier debugging):
  ```php
  $items->each(function(Item $item) {
      $this->info("Processing item id `{$item->id}`...");
      $this->processItem($item);
  });
  
  $this->comment("Processed {$items->count()} items.");
  ```

## Enums

- Use PascalCase for enum values:

> **Laravel 8 caveat:** Native PHP enum support (backed enums, enum casting in Eloquent via `$casts`) requires Laravel 9+. In Laravel 8, you will need to use a package such as `spatie/laravel-enum` or `BenSampo/laravel-enum`, or implement manual accessor/mutator logic on your models to achieve similar functionality. The PascalCase naming convention still applies to whichever enum approach you use.

## Strings & Formatting

- **String interpolation** over concatenation:

## Comments

Be very critical about adding comments as they often become outdated and can mislead over time. Code should be self-documenting through descriptive variable and function names.

Adding comments should never be the first tactic to make code readable.

*Instead of this:*
```php
// Get the failed checks for this site
$checks = $site->checks()->where('status', 'failed')->get();
```

*Do this:*
```php
$failedChecks = $site->checks()->where('status', 'failed')->get();
```

**Guidelines:**
- Don't add comments that describe what the code does - make the code describe itself
- Short, readable code doesn't need comments explaining it
- Use descriptive variable names instead of generic names + comments
- Only add comments when explaining *why* something non-obvious is done, not *what* is being done
- Never add comments to tests - test names should be descriptive enough

## Whitespace

- Add blank lines between statements for readability
- Exception: sequences of equivalent single-line operations
- No extra empty lines between `{}` brackets
- Let code "breathe" - avoid cramped formatting

## Validation

- Use array notation for multiple rules (easier for custom rule classes):
  ```php
  public function rules() {
      return [
          'email' => ['required', 'email'],
      ];
  }
  ```
- Custom validation rules use snake_case:
  ```php
  Validator::extend('organisation_type', function ($attribute, $value) {
      return OrganisationType::isValid($value);
  });
  ```

> **Laravel 8 caveat:** Invokable custom rule classes (`php artisan make:rule`) in Laravel 8 use the `passes()` and `message()` methods. The simplified invokable rule syntax (single `__invoke` method with a `$fail` closure) was introduced in Laravel 9. When writing custom rule classes in Laravel 8, use the older interface.

## Blade Templates

- Indent with 4 spaces
- No spaces after control structures:
  ```blade
  @if($condition)
      Something
  @endif
  ```

## Authorization

- Policies use camelCase: `Gate::define('editPost', ...)`
- Use CRUD words, but `view` instead of `show`

## Translations

- Use `__()` function over `@lang`:

## API Routing

- Use plural resource names: `/errors`
- Use kebab-case: `/error-occurrences`
- Limit deep nesting for simplicity:
  ```
  /error-occurrences/1
  /errors/1/occurrences
  ```

## Testing

- Keep test classes in same file when possible
- Use descriptive test method names
- Follow the arrange-act-assert pattern

> **Laravel 8 caveat:** Laravel 8 does not include Pest PHP out of the box. If you want to use Pest-style test syntax (e.g., `it()`, `test()`, `expect()`), you will need to install `pestphp/pest` separately. Otherwise, stick with PHPUnit-style test classes extending `TestCase`.

## Quick Reference

### Naming Conventions
- **Classes**: PascalCase (`UserController`, `OrderStatus`)
- **Methods/Variables**: camelCase (`getUserName`, `$firstName`)
- **Routes**: kebab-case (`/open-source`, `/user-profile`)
- **Config files**: kebab-case (`pdf-generator.php`)
- **Config keys**: snake_case (`chrome_path`)
- **Artisan commands**: kebab-case (`php artisan delete-old-records`)

### File Structure
- Controllers: plural resource name + `Controller` (`PostsController`)
- Views: camelCase (`openSource.blade.php`)
- Jobs: action-based (`CreateUser`, `SendEmailNotification`)
- Events: tense-based (`UserRegistering`, `UserRegistered`)
- Listeners: action + `Listener` suffix (`SendInvitationMailListener`)
- Commands: action + `Command` suffix (`PublishScheduledPostsCommand`)
- Mailables: purpose + `Mail` suffix (`AccountActivatedMail`)
- Resources/Transformers: plural + `Resource`/`Transformer` (`UsersResource`)
- Enums: descriptive name, no prefix (`OrderStatus`, `BookingType`)

### Migrations
- Do not write down methods in migrations, only up methods

> **Laravel 8 caveat:** Laravel 8 introduced anonymous migration classes as an opt-in feature, but named migration classes are still the default. Anonymous migrations became the default in Laravel 9. Both styles support omitting the `down()` method. Be aware that if your team uses `migrate:rollback` during development, omitting `down()` means rollbacks will have no effect for those migrations.

### Code Quality Reminders

#### PHP
- Use typed properties over docblocks
- Prefer early returns over nested if/else
- Use constructor property promotion when all properties can be promoted
- Avoid `else` statements when possible
- Use string interpolation over concatenation
- Always use curly braces for control structures

---

## Laravel 8 Compatibility Summary

The following is a summary of all Laravel 8-specific caveats referenced throughout this document:

| Guideline | Laravel 8 Impact |
|---|---|
| **Tuple route syntax** | Supported but not the default; `RouteServiceProvider` still includes `$namespace` property |
| **Native PHP enums / Eloquent enum casting** | Requires Laravel 9+; use a package like `spatie/laravel-enum` or manual accessors in Laravel 8 |
| **Invokable rule classes** | Laravel 8 uses `passes()`/`message()` interface; the `$fail` closure syntax requires Laravel 9+ |
| **Anonymous migrations** | Available as opt-in in Laravel 8; named migration classes are still the default |
| **Pest PHP** | Not bundled with Laravel 8; must be installed separately |
| **Laravel 8 EOL** | Laravel 8 reached end of life (including security fixes) in early 2023. If running PHP 8.1+, upgrading to Laravel 10 or 11 is strongly recommended. |
