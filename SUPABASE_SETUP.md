# Supabase conversion status

This is the safe test copy of the working `CVsoccer` site. It continues using
Google storage until the Supabase project is connected and tested.

## Already prepared

- Supabase connection placeholders in `config.js`
- Initial database and security functions in `supabase/schema.sql`
- Public reads that exclude email addresses, phone numbers and notes
- Atomic signups that protect the final opening from simultaneous claims
- Authenticated creator read/write functions
- Existing `testcoach.cvsoccer.club` address preserved

## Remaining connection steps

1. Create the Supabase project.
2. Run `supabase/schema.sql` in its SQL Editor.
3. Enter the Project URL and publishable/anon key in `config.js`.
4. Add the organizer account through Supabase Authentication.
5. Connect the public and creator pages to the Supabase functions.
6. Import the current events and signups.
7. Test at `testcoach.cvsoccer.club`.
8. Change `storageProvider` from `google` to `supabase` after testing passes.

Never place the Supabase service-role key in this repository or in browser code.
