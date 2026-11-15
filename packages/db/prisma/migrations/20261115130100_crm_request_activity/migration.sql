-- Sprint 16 (sprint-16-domain-model.md): a request that arrived from
-- outside (the website) is logged as its own activity type, so "nobody
-- has answered yet" can be told apart from a note a member wrote.
ALTER TYPE "activity_type" ADD VALUE 'REQUEST';
