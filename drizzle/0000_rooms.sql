CREATE TABLE rooms (id TEXT PRIMARY KEY, host TEXT NOT NULL, guest TEXT, host_tag TEXT NOT NULL, guest_tag TEXT, avoid TEXT, htime INTEGER NOT NULL, gtime INTEGER, offer TEXT, answer TEXT);
--> statement-breakpoint
CREATE INDEX available ON rooms(guest,htime);
--> statement-breakpoint
CREATE TABLE reports (id TEXT PRIMARY KEY, room TEXT NOT NULL, reported_tag TEXT NOT NULL, reason TEXT NOT NULL, created INTEGER NOT NULL);
