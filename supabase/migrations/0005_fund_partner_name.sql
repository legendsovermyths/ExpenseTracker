-- Denormalize the fund partner's display name onto the fund row itself,
-- same idea as balance_pair_me already denormalizing a name for splits.
-- Needed because a fund partner (picked via live profile search) may have
-- no split/ledger relationship with the owner yet, so their name can't be
-- resolved from userbalances alone.
alter table fund add column if not exists other_participant_name text;
