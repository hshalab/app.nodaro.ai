-- Flux 2: align the BARE model_pricing rows with the per-MP grid they claim to summarise.
--
-- THE DEFECT. `flux-2-klein` and `flux-2-pro` each carry a bare model_pricing
-- row that is documented as "the default resolution" but disagrees with the
-- grid row for that exact resolution:
--
--   flux-2-klein       = 10   vs  flux-2-klein:1MP:0ref = 3
--   flux-2-pro         = 30   vs  flux-2-pro:2MP:0ref   = 23
--   flux-2-max         = 70   vs  flux-2-max:2MP:0ref   = 70   (already agrees)
--
-- The grid is authoritative for two independent reasons: it is what BILLS
-- (`buildCreditModelIdentifier` always emits `<model>:<mp>MP:<n>ref` for the
-- Flux 2 family, so no request can ever resolve to the bare id), and it is
-- generated from the `flux2BaseCredits` provider-cost formula rather than
-- hand-written.
--
-- The bare values are a rounding artifact. At the pre-2026-07-30 credit scale
-- the true costs were ~0.3 and ~2.3 and got rounded UP to 1 and 3; the x10
-- re-denomination then multiplied that error into 10 and 30. Only max, whose
-- pre-flip value of 7 needed no rounding, survived intact.
--
-- WHY THIS MATTERS EVEN THOUGH THE BARE ID NEVER BILLS. `model_pricing` wins
-- over `STATIC_CREDIT_COSTS`, so `GET /v1/credits/model-cost?model=flux-2-klein`
-- served 10 while the model catalog advertised 3 and the actual charge was 3.
-- Verified on staging before writing this. Anyone reading the price through the
-- API or /admin/models saw a number no request can produce.
--
-- NOT A PRICE CHANGE. Every value here already governs real charges via the
-- grid; this only stops a summary row from contradicting it. Raising the grid
-- to 10/30 instead would be a 3.3x / 1.3x increase — a business decision, not
-- a data repair.
--
-- Convergent and idempotent, matching 275-288: re-running is a no-op.

BEGIN;

INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('flux-2-klein', 3)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;

INSERT INTO model_pricing (model_identifier, credit_cost) VALUES ('flux-2-pro', 23)
  ON CONFLICT (model_identifier) DO UPDATE SET credit_cost = EXCLUDED.credit_cost;

-- flux-2-max is deliberately absent: its bare row (70) already matches
-- flux-2-max:2MP:0ref, so touching it would be noise.

COMMIT;
