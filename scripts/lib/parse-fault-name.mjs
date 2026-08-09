// CGS fault NAME values look like "{Zone}, {Section} section (Strand)",
// sometimes missing the section ("Green Valley fault zone (Green Valley
// fault)") or the strand, or with no comma at all ("Unnamed fault north of
// Concord"). The parenthetical strand can appear directly after the zone
// with no comma, so it must be stripped *before* splitting on the first
// comma -- splitting first misclassifies "Green Valley fault zone (Green
// Valley fault)" / "Rodgers Creek fault zone (Rodgers Creek fault)" as
// branches (the zone swallows the "(...)").
const TRAILING_PAREN = /\s*\(([^()]+)\)\s*$/;

export function parseFaultName(name) {
  const parenMatch = name.match(TRAILING_PAREN);
  const strand = parenMatch ? parenMatch[1].trim() : undefined;
  const remainder = parenMatch ? name.slice(0, parenMatch.index).trim() : name.trim();

  const commaIndex = remainder.indexOf(",");
  const zone = commaIndex === -1 ? remainder : remainder.slice(0, commaIndex).trim();

  const coreStrand = zone.endsWith(" zone") ? zone.slice(0, -" zone".length) : zone;
  const effectiveStrand = strand ?? coreStrand;
  const isMain = effectiveStrand === coreStrand;

  return { zone, strand, isMain, groupKey: `${zone}::${effectiveStrand}` };
}
