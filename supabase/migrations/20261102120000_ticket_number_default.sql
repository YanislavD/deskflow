-- tickets.number wird immer vom Trigger private.assign_ticket_number() gesetzt
-- (ein vom Client mitgeschickter Wert wird überschrieben). Mit einem Standardwert
-- gilt die Spalte in den generierten TypeScript-Typen als optional, sodass das
-- Frontend sie beim INSERT nicht angeben muss.

alter table public.tickets alter column number set default 0;
