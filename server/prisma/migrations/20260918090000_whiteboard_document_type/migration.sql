-- Whiteboards are documents of their own kind (`type = 'whiteboard'`), listed
-- in their own workspace. The allowed-type set is enforced here as well as in
-- CreateDiagramDto, so extend the constraint rather than drop it.
ALTER TABLE "Diagram" DROP CONSTRAINT "Diagram_type_check";
ALTER TABLE "Diagram"
  ADD CONSTRAINT "Diagram_type_check"
  CHECK ("type" IN ('erd', 'uml', 'flowchart', 'dfd', 'terrain', 'whiteboard'));
