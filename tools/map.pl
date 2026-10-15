#!/usr/bin/perl
# Build the map and game data from docs/SCENARIO.md (map facts) and docs/map-base.svg (map geometry):
#   docs/map.svg         the map, every part addressable by id/class for the web game
#   docs/scenario.json   the scenario as data for the game
# and refresh the generated parts of SCENARIO.md.
#
#   perl tools/map.pl              check the data, rebuild map.svg and scenario.json, refresh SCENARIO.md
#   perl tools/map.pl mountains    the same, but first move any mountain that touches something
#
# Only core Perl is needed.
use strict; use warnings; use utf8; use open qw(:std :encoding(UTF-8));
use File::Basename qw(dirname); use Cwd qw(abs_path); use JSON::PP; use List::Util qw(min max);

my $ROOT = dirname(dirname(abs_path(__FILE__)));
my ($DOC, $BASE, $SVG, $JSON) = map { "$ROOT/docs/$_" } qw(SCENARIO.md map-base.svg map.svg scenario.json);
my $MODE = shift // 'draw'; die "usage: $0 [mountains]\n" unless $MODE =~ /^(draw|mountains)$/;

# ---------- look (sizes in map units = pixels at 100%) ----------
my $STYLE = <<'CSS';
.sea{fill:#99d9ea}
.landmass{fill:#fff}
.land{fill:#fff}
.coast{fill:none;stroke:#000;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.frame{fill:none;stroke:#7f7f7f;stroke-width:4}
.edge{fill:none;stroke-linejoin:round;stroke-linecap:round}
.border{stroke:#7f7f7f;stroke-width:2.5}
.province{stroke:none}
.river{fill:none;stroke:#00a2e8;stroke-width:2.5;stroke-linejoin:round;stroke-linecap:round}
.route{fill:none;stroke:#bebebe;stroke-width:1.4}
.strait{stroke-dasharray:3.5 3.5}
.mtn-lit{fill:#c4aa88}
.mtn-shade{fill:#967656}
.mtn-snow{fill:#fcfcfc}
.mtn-snow-shade{fill:#d6dce4}
.mtn-outline{fill:none;stroke:#5f4128;stroke-width:1.4;stroke-linejoin:round}
.pass{fill:#ffe600;stroke:#282828;stroke-width:1.5;stroke-linejoin:round}
.marker{fill:#c9161f}
.number{fill:#fff;font-size:10px;font-weight:bold;text-anchor:middle}
.label{fill:#464646;font-size:15px;text-anchor:middle}
.label.small{font-size:10px}
CSS
my ($PASS_SIDE, $TOWN_R, $CITY_SIDE) = (20, 9, 22);
my ($MTN_W, $MTN_H) = (30, 26);
my ($MTN_GAP, $MTN_REACH) = (5, 40);     # clear space around a mountain; how far `mountains` may move one
my $RIVER_NEAR = 24;                     # a settlement this close to a river is "on a river" (RULES.md §2)
my $CHAR_W = 0.72;                       # rough width of a capital letter, in em, for placing labels

# =====================================================================================
# SCENARIO.md
# =====================================================================================
open my $fh, '<', $DOC or die "$DOC: $!"; my @doc = <$fh>; close $fh; chomp @doc;
my @ERR; sub err { push @ERR, sprintf(shift, @_) }
sub check { die "$_[0] has errors:\n" . join('', map { "  $_\n" } @ERR) if @ERR }

sub section { my $t = shift; my ($s) = grep { $doc[$_] =~ /^## \Q$t\E\s*$/ } 0 .. $#doc; die "SCENARIO.md: no '## $t' section\n" unless defined $s;
    my $e = $s + 1; $e++ while $e <= $#doc && $doc[$e] !~ /^#{1,2} /; return ($s, $e - 1) }
sub cells { my $l = shift; $l =~ s/^\s*\|//; $l =~ s/\|\s*$//; map { my $c = $_; $c =~ s/\*\*//g; $c =~ s/^\s+|\s+$//g; $c } split /\|/, $l, -1 }
# table($section) -> (\@header, \@rows as hashes, first line, last line)
sub table { my ($s, $e) = section(shift); my $i = $s; $i++ while $i <= $e && $doc[$i] !~ /^\|/; die "SCENARIO.md: no table under '$doc[$s]'\n" if $i > $e;
    my @h = cells($doc[$i]); my $j = $i + 2; my @rows;
    while ($j <= $#doc && $doc[$j] =~ /^\|/) { my @c = cells($doc[$j]); my %r; @r{@h} = map { $_ // '' } @c; $r{_line} = $j + 1; push @rows, \%r; $j++ }
    return (\@h, \@rows, $i, $j - 1) }
sub ids { my $s = shift // ''; grep { /\S/ } split /\s*,\s*/, $s }

my (%CN, @CORDER);                       # country code -> name, in table order
{ my (undef, $rows) = table('Countries');
  for my $r (@$rows) { my ($c, $n) = @$r{qw(Code Country)}; err("Countries line %d: duplicate code %s", $r->{_line}, $c) if $CN{$c};
      err("Countries line %d: code '%s' must be capital letters", $r->{_line}, $c) unless $c =~ /^[A-Z]+$/; $CN{$c} = $n; push @CORDER, $c } }

my %S;                                   # id -> { name country city port hre x y nb[] st[] }
{ my (undef, $rows) = table('Settlements');
  for my $r (@$rows) { my $id = $r->{ID}; my $l = $r->{_line};
      err("Settlements line %d: bad ID '%s'", $l, $id), next unless $id =~ /^\d+$/; err("Settlements line %d: duplicate ID %d", $l, $id) if $S{$id};
      err("settlement %d: unknown country '%s'", $id, $r->{Country}) unless $CN{ $r->{Country} };
      err("settlement %d: Type must be town or city", $id) unless $r->{Type} =~ /^(town|city)$/;
      err("settlement %d: Port must be 'port' or empty", $id) unless $r->{Port} =~ /^(port|)$/;
      err("settlement %d: HRE must be 'HRE' or empty", $id) unless $r->{HRE} =~ /^(HRE|)$/;
      err("settlement %d: X and Y must be whole numbers", $id) unless "$r->{X} $r->{Y}" =~ /^\d+ \d+$/;
      $S{$id} = { name => $r->{Name}, country => $r->{Country}, city => $r->{Type} eq 'city', port => $r->{Port} eq 'port', hre => $r->{HRE} eq 'HRE',
                  x => $r->{X}, y => $r->{Y}, nb => [ ids($r->{Borders}) ], st => [ ids($r->{Straits}) ] } } }
my (%LAND, %STRAIT);                     # "a-b" with a < b
for my $a (sort { $a <=> $b } keys %S) { for ([nb => \%LAND, 'Borders'], [st => \%STRAIT, 'Straits']) { my ($k, $set, $col) = @$_;
    for my $b (@{ $S{$a}{$k} }) { err("settlement %d %s: unknown settlement '%s'", $a, $col, $b), next unless $S{$b};
        err("settlement %d %s lists %d, but %d does not list %d", $a, $col, $b, $b, $a) unless grep { $_ eq $a } @{ $S{$b}{$k} };
        $set->{ $a < $b ? "$a-$b" : "$b-$a" } = 1 } } }
for my $c (@CORDER) { err("country %s has no settlements", $c) unless grep { $_->{country} eq $c } values %S }

my @PASSES;
{ my (undef, $rows) = table('Mountain passes');
  for my $r (@$rows) { my @routes = map { my ($a, $b) = sort { $a <=> $b } split /-/; "$a-$b" } ids($r->{Routes});
      err("pass %s: X and Y must be whole numbers", $r->{Pass}) unless "$r->{X} $r->{Y}" =~ /^\d+ \d+$/;
      for (@routes) { err("pass %s: route %s is not in Borders", $r->{Pass}, $_) unless $LAND{$_} }
      push @PASSES, { id => $r->{Pass}, x => $r->{X}, y => $r->{Y}, routes => \@routes } } }
my %VIA; for my $p (@PASSES) { for (@{ $p->{routes} }) { err("route %s goes through two passes", $_) if $VIA{$_}; $VIA{$_} = $p } }

my @PEAKS;                               # the ``` block under ## Mountains
{ my ($s, $e) = section('Mountains'); my @f = grep { $doc[$_] =~ /^```/ } $s .. $e; die "SCENARIO.md: no ``` block under ## Mountains\n" unless @f >= 2;
  for my $i ($f[0] + 1 .. $f[1] - 1) { push @PEAKS, [ $1, $2 ] while $doc[$i] =~ /(\d+),(\d+)/g } }
check('SCENARIO.md');

# =====================================================================================
# map-base.svg: one shape per settlement's land, and the rivers
# =====================================================================================
open $fh, '<', $BASE or die "$BASE: $!"; my $base = do { local $/; <$fh> }; close $fh; $base =~ s/<!--.*?-->//gs;
my ($W, $H) = $base =~ /viewBox="0 0 ([\d.]+) ([\d.]+)"/ or die "map-base.svg: no viewBox\n";
die "map-base.svg: transforms are not supported (in Inkscape: Edit > Preferences > Behavior > Transforms > Store transformation: optimized, then nudge the item)\n" if $base =~ /transform=/;
# path data -> list of rings (straight segments only)
sub parse_d { my ($d, $what) = @_; my (@rings, @cur, $cx, $cy, $sx, $sy, $cmd);
    die "map-base.svg: $what uses curves; only straight segments are allowed\n" if $d =~ /[CcSsQqTtAa]/;
    my @tok = $d =~ /([MmLlHhVvZz])|([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g; @tok = grep { defined } @tok; my $i = 0;
    my $close = sub { push @rings, [@cur] if @cur >= 3; @cur = () };
    while ($i < @tok) {
        if ($tok[$i] =~ /^[A-Za-z]$/) { $cmd = $tok[$i++]; if ($cmd =~ /[Zz]/) { $close->(); ($cx, $cy) = ($sx, $sy); next } }
        die "map-base.svg: $what: bad path data\n" unless defined $cmd;
        if ($cmd =~ /[MmLl]/) { my ($x, $y) = @tok[$i, $i + 1]; $i += 2; if ($cmd =~ /[ml]/ && defined $cx) { $x += $cx; $y += $cy }
            if ($cmd =~ /[Mm]/) { $close->(); ($sx, $sy) = ($x, $y); $cmd = $cmd eq 'm' ? 'l' : 'L' } ($cx, $cy) = ($x, $y); push @cur, [$x, $y] }
        elsif ($cmd eq 'H') { $cx = $tok[$i++]; push @cur, [$cx, $cy] } elsif ($cmd eq 'h') { $cx += $tok[$i++]; push @cur, [$cx, $cy] }
        elsif ($cmd eq 'V') { $cy = $tok[$i++]; push @cur, [$cx, $cy] } elsif ($cmd eq 'v') { $cy += $tok[$i++]; push @cur, [$cx, $cy] } }
    my @open = @cur; $close->(); return (\@rings, \@open) }
sub rnd { 0 + sprintf '%.2f', $_[0] }
my (%LANDS, @RIVERS);
for my $a ($base =~ /<path\b([^>]*)>/g) { my ($id) = $a =~ /\bid="([^"]*)"/; my ($d) = $a =~ /\bd="([^"]*)"/; next unless defined $d;
    if (defined $id && $id =~ /^land-(\d+)$/) { my ($r) = parse_d($d, $id); $LANDS{$1} = [ map { [ map { [ rnd($_->[0]), rnd($_->[1]) ] } @$_ ] } @$r ];
        err("map-base.svg: %s has no closed shape", $id) unless @$r } }
my ($rivg) = $base =~ /<g\b[^>]*\bid="rivers"[^>]*>(.*?)<\/g>/s;      # rivers: the paths in the group with id "rivers"
for my $a (($rivg // '') =~ /<path\b([^>]*)>/g) { my ($d) = $a =~ /\bd="([^"]*)"/ or next; my (undef, $open) = parse_d($d, 'a river'); push @RIVERS, $open if @$open >= 2 }
for my $id (sort { $a <=> $b } keys %S) { err("map-base.svg: no land-%d for settlement %d", $id, $id) unless $LANDS{$id} }
for my $id (sort { $a <=> $b } keys %LANDS) { err("map-base.svg: land-%d has no settlement in SCENARIO.md", $id) unless $S{$id} }
check('map-base.svg');

sub inside { my ($x, $y, $rings) = @_; my $in = 0;
    for my $r (@$rings) { for my $i (0 .. $#$r) { my ($a, $b) = ($r->[$i], $r->[ $i - 1 ]);
        $in = !$in if ($a->[1] > $y) != ($b->[1] > $y) && $x < $a->[0] + ($y - $a->[1]) / ($b->[1] - $a->[1]) * ($b->[0] - $a->[0]) } } $in }
sub land_at { my ($x, $y) = @_; for my $id (sort { $a <=> $b } keys %LANDS) { return $id if inside($x, $y, $LANDS{$id}) } 0 }
for my $id (sort { $a <=> $b } keys %S) { err("settlement %d (%d,%d) is not inside land-%d", $id, $S{$id}{x}, $S{$id}{y}, $id) unless inside($S{$id}{x}, $S{$id}{y}, $LANDS{$id}) }
for my $p (@PASSES) { $p->{owner} = land_at($p->{x}, $p->{y}) or err("pass %s (%d,%d) is not on land", $p->{id}, $p->{x}, $p->{y}) }

# edges: every side of every land is shared with exactly one neighbour, or is coast, or lies on the frame
my (%SEG, %PK); sub pk { "$_[0][0],$_[0][1]" }
for my $id (sort { $a <=> $b } keys %LANDS) { for my $r (@{ $LANDS{$id} }) { for my $i (0 .. $#$r) { my ($a, $b) = ($r->[$i], $r->[ ($i + 1) % @$r ]); next if pk($a) eq pk($b);
    my $k = pk($a) lt pk($b) ? pk($a) . '|' . pk($b) : pk($b) . '|' . pk($a); $PK{ pk($_) } = $_ for $a, $b; push @{ $SEG{$k} }, $id } } }
my (%PAIR, @COAST, @FRAME);              # "a-b" -> segments; segment = [p, q]
for my $k (sort keys %SEG) { my @own = @{ $SEG{$k} }; my ($p, $q) = map { $PK{$_} } split /\|/, $k;
    if (@own > 2) { err("edge %s is shared by more than two lands (%s)", $k, join ', ', map { "land-$_" } @own); next }
    if (@own == 2) { my ($a, $b) = sort { $a <=> $b } @own; err("land-%d overlaps itself at %s", $a, $k) if $a == $b; push @{ $PAIR{"$a-$b"} }, [$p, $q]; next }
    if (($p->[0] == 0 && $q->[0] == 0) || ($p->[0] == $W && $q->[0] == $W) || ($p->[1] == 0 && $q->[1] == 0) || ($p->[1] == $H && $q->[1] == $H)) { push @FRAME, [$p, $q]; next }
    my ($mx, $my) = (($p->[0] + $q->[0]) / 2, ($p->[1] + $q->[1]) / 2); my ($nx, $ny) = ($q->[1] - $p->[1], $p->[0] - $q->[0]); my $nl = sqrt($nx * $nx + $ny * $ny) || 1;
    ($nx, $ny) = ($nx / $nl * 0.75, $ny / $nl * 0.75);
    if (land_at($mx + $nx, $my + $ny) && land_at($mx - $nx, $my - $ny)) { err("land-%d: its edge near %.0f,%.0f does not match its neighbour's points exactly", $own[0], $mx, $my); next }
    push @COAST, [$p, $q] }
check('map-base.svg');
# a river that reaches the sea must end exactly on the coastline
for my $r (@RIVERS) { for my $p ($r->[0], $r->[-1]) { my $d = min(map { seg_dist(@$p, @$_) } @COAST);
    warn sprintf "map-base.svg: a river ends %.1f from the coast near %.0f,%.0f -- move its end onto the coastline\n", $d, @$p if $d > 0.3 && $d < 12 } }
# join segments into as few polylines as possible
sub chains { my @segs = @_; my %adj; for my $i (0 .. $#segs) { push @{ $adj{ pk($segs[$i][0]) } }, $i; push @{ $adj{ pk($segs[$i][1]) } }, $i }
    my (%used, @out);
    my $walk = sub { my ($start, $i) = @_; my @pts = ($PK{$start}); my $cur = $start;
        while (defined $i && !$used{$i}) { $used{$i} = 1; my ($a, $b) = map { pk($_) } @{ $segs[$i] }; $cur = $a eq $cur ? $b : $a; push @pts, $PK{$cur};
            ($i) = grep { !$used{$_} } @{ $adj{$cur} }; last if @{ $adj{$cur} } != 2 } push @out, \@pts };
    for my $v (sort grep { @{ $adj{$_} } != 2 } keys %adj) { for my $i (@{ $adj{$v} }) { $walk->($v, $i) unless $used{$i} } }
    for my $i (0 .. $#segs) { $walk->(pk($segs[$i][0]), $i) unless $used{$i} }
    return @out }

# =====================================================================================
# layout on a pixel grid: which land each pixel is in, what is already drawn there
# =====================================================================================
my @REG = map { [ (0) x $W ] } 1 .. $H; my %OVER;
for my $id (sort { $a <=> $b } keys %LANDS) { my @e; for my $r (@{ $LANDS{$id} }) { push @e, map { [ $r->[$_], $r->[ $_ - 1 ] ] } 0 .. $#$r }
    my ($y0, $y1) = (1e9, -1); for (@e) { for my $p (@$_) { $y0 = $p->[1] if $p->[1] < $y0; $y1 = $p->[1] if $p->[1] > $y1 } }
    for my $y (($y0 < 0 ? 0 : int $y0) .. ($y1 >= $H ? $H - 1 : int $y1)) { my $py = $y + 0.5;
        my @xs = sort { $a <=> $b } map { my ($a, $b) = @$_; ($a->[1] > $py) != ($b->[1] > $py) ? $a->[0] + ($py - $a->[1]) / ($b->[1] - $a->[1]) * ($b->[0] - $a->[0]) : () } @e;
        while (@xs >= 2) { my ($l, $r) = splice @xs, 0, 2; for my $x (int($l + 0.5) .. int($r + 0.5) - 1) { next unless $x >= 0 && $x < $W;
            $OVER{ $REG[$y][$x] < $id ? "$REG[$y][$x]-$id" : "$id-$REG[$y][$x]" }++ if $REG[$y][$x]; $REG[$y][$x] = $id } } } }
for my $k (sort keys %OVER) { err("land-%s and land-%s overlap (%d px)", split(/-/, $k), $OVER{$k}) if $OVER{$k} > 3 }
{ my (%seen, @gaps);      # anything that is not land must be sea: a small patch of it is a gap between lands
  for my $y (0 .. $H - 1) { for my $x (0 .. $W - 1) { next if $REG[$y][$x] || $seen{"$x,$y"}; my @st = ([$x, $y]); $seen{"$x,$y"} = 1; my $n = 0;
      while (my $p = pop @st) { $n++; for ([1, 0], [-1, 0], [0, 1], [0, -1]) { my ($u, $v) = ($p->[0] + $_->[0], $p->[1] + $_->[1]);
          next if $u < 0 || $v < 0 || $u >= $W || $v >= $H || $REG[$v][$u] || $seen{"$u,$v"}++; push @st, [$u, $v] } }
      push @gaps, "$x,$y" if $n < 2000 } }
  err("%d gap(s) between lands, first near %s: neighbouring lands must share exactly the same points", scalar @gaps, join(' ', @gaps[0 .. ($#gaps < 2 ? $#gaps : 2)])) if @gaps }
check('map-base.svg');
sub inb { $_[0] >= 0 && $_[1] >= 0 && $_[0] < $W && $_[1] < $H }
my @OCC = map { [ (0) x $W ] } 1 .. $H;
sub occ_seg { my ($x1, $y1, $x2, $y2, $hw) = @_; my ($dx, $dy) = ($x2 - $x1, $y2 - $y1); my $L2 = $dx * $dx + $dy * $dy;
    for my $y (int(($y1 < $y2 ? $y1 : $y2) - $hw) - 1 .. int(($y1 > $y2 ? $y1 : $y2) + $hw) + 1) { for my $x (int(($x1 < $x2 ? $x1 : $x2) - $hw) - 1 .. int(($x1 > $x2 ? $x1 : $x2) + $hw) + 1) {
        next unless inb($x, $y); my ($px, $py) = ($x + 0.5, $y + 0.5); my $t = $L2 ? (($px - $x1) * $dx + ($py - $y1) * $dy) / $L2 : 0; $t = $t < 0 ? 0 : $t > 1 ? 1 : $t;
        $OCC[$y][$x] = 1 if ($px - $x1 - $t * $dx)**2 + ($py - $y1 - $t * $dy)**2 <= ($hw + 0.5)**2 } } }
sub occ_line { my ($pts, $hw) = @_; occ_seg(@{ $pts->[$_ - 1] }, @{ $pts->[$_] }, $hw) for 1 .. $#$pts }
sub occ_box { my ($x0, $y0, $x1, $y1) = @_; for my $y (int $y0 .. int $y1) { for my $x (int $x0 .. int $x1) { $OCC[$y][$x] = 1 if inb($x, $y) } } }

# routes as polylines: settlement -> [pass ->] settlement. A land route may only cross land of the countries it
# joins (and of its pass). One whose straight line leaves that land - out to sea or through a third country - is
# bent: the shortest way over the allowed land, kept off the shore and other countries, pulled as straight as it allows.
my @SEAD = map { [ (99) x $W ] } 1 .. $H;           # distance to the sea, up to 12
{ my @q; for my $y (0 .. $H - 1) { for my $x (0 .. $W - 1) { unless ($REG[$y][$x]) { $SEAD[$y][$x] = 0; push @q, [$x, $y] } } }
  for my $d (1 .. 12) { my @n; for my $c (@q) { for ([1, 0], [-1, 0], [0, 1], [0, -1]) { my ($u, $v) = ($c->[0] + $_->[0], $c->[1] + $_->[1]);
      next unless inb($u, $v) && $SEAD[$v][$u] > $d; $SEAD[$v][$u] = $d; push @n, [$u, $v] } } @q = @n } }
my ($ROUTE_SHORE, $ROUTE_MARGIN) = (8, 6);          # a bent route keeps this far from the sea / from other countries where it can
my @NEARC;                                          # pixels within $ROUTE_MARGIN of another country: every country that close
{ my @q; for my $y (0 .. $H - 1) { for my $x (0 .. $W - 1) { my $id = $REG[$y][$x] or next;
      push @q, [$x, $y] if grep { my ($u, $v) = ($x + $_->[0], $y + $_->[1]); inb($u, $v) && $REG[$v][$u] && $S{ $REG[$v][$u] }{country} ne $S{$id}{country} } [1, 0], [-1, 0], [0, 1], [0, -1] } }
  my %near = map { ("$_->[0],$_->[1]" => 1) } @q;
  for (1 .. $ROUTE_MARGIN) { my @n; for my $c (@q) { for ([1, 0], [-1, 0], [0, 1], [0, -1]) { my ($u, $v) = ($c->[0] + $_->[0], $c->[1] + $_->[1]); next if !inb($u, $v) || $near{"$u,$v"}++; push @n, [$u, $v] } } @q = @n }
  my @disc = grep { $_->[0]**2 + $_->[1]**2 <= $ROUTE_MARGIN**2 } map { my $dy = $_; map { [$_, $dy] } -$ROUTE_MARGIN .. $ROUTE_MARGIN } -$ROUTE_MARGIN .. $ROUTE_MARGIN;
  for my $k (keys %near) { my ($x, $y) = split /,/, $k; my %c;
      for (@disc) { my ($u, $v) = ($x + $_->[0], $y + $_->[1]); $c{ $S{ $REG[$v][$u] }{country} } = 1 if inb($u, $v) && $REG[$v][$u] } $NEARC[$y][$x] = [ keys %c ] if keys %c > 1 } }
# may a route pass this pixel? land at least $clear from the sea, in an allowed country, and (with $margin) not near any other country
sub pix_ok { my ($x, $y, $clear, $allow, $margin) = @_; return 0 if !inb($x, $y) || $SEAD[$y][$x] < $clear || !$allow->{ $S{ $REG[$y][$x] }{country} };
    return 0 if $margin && $NEARC[$y][$x] && grep { !$allow->{$_} } @{ $NEARC[$y][$x] }; 1 }
# does the straight leg a-b only pass such pixels? the part under a marker at either end does not count
sub leg_ok { my ($a, $b, $clear, $margin, $allow, $skipa, $skipb) = @_; my $L = sqrt(($b->[0] - $a->[0])**2 + ($b->[1] - $a->[1])**2);
    for my $i (0 .. int $L) { next if ($skipa && $i < 12) || ($skipb && $L - $i < 12); my $t = $L ? $i / $L : 0;
        return 0 unless pix_ok(int($a->[0] + ($b->[0] - $a->[0]) * $t), int($a->[1] + ($b->[1] - $a->[1]) * $t), $clear, $allow, $margin) } 1 }
sub land_path { my ($a, $b, $allow, $margin) = @_; my ($sx, $sy, $tx, $ty) = map { int } (@$a, @$b);
    my ($x0, $x1) = (min($sx, $tx) - 200, max($sx, $tx) + 200); my ($y0, $y1) = (min($sy, $ty) - 200, max($sy, $ty) + 200);
    my %cost = ("$sx,$sy" => 0); my %par; my @bucket = (["$sx,$sy"]); my $found;
    B: for (my $c = 0; $c < @bucket; $c++) { for my $k (@{ $bucket[$c] // [] }) { next if $cost{$k} < $c; if ($k eq "$tx,$ty") { $found = 1; last B } my ($x, $y) = split /,/, $k;
        for ([1, 0, 10], [-1, 0, 10], [0, 1, 10], [0, -1, 10], [1, 1, 14], [1, -1, 14], [-1, 1, 14], [-1, -1, 14]) { my ($u, $v) = ($x + $_->[0], $y + $_->[1]);
            next if $u < $x0 || $u > $x1 || $v < $y0 || $v > $y1 || !inb($u, $v);
            my $under = ($u - $sx)**2 + ($v - $sy)**2 < 144 || ($u - $tx)**2 + ($v - $ty)**2 < 144; next unless $under || pix_ok($u, $v, 1, $allow, $margin);
            my $sd = $SEAD[$v][$u]; my $nc = $c + $_->[2] + ($under || $sd >= 11 ? 0 : (11 - $sd) * 6); my $kk = "$u,$v"; next if exists $cost{$kk} && $cost{$kk} <= $nc;
            $cost{$kk} = $nc; $par{$kk} = $k; push @{ $bucket[$nc] }, $kk } } }
    return undef unless $found;
    my @p; my $k = "$tx,$ty"; while (defined $k) { unshift @p, [ map { $_ + 0.5 } split /,/, $k ]; $k = $par{$k} } $p[0] = [@$a]; $p[-1] = [@$b];
    my @out = ($p[0]); my $i = 0;
    while ($i < $#p) { my $j = $#p; $j-- while $j > $i + 1 && !leg_ok($p[$i], $p[$j], $ROUTE_SHORE, $margin, $allow, $i == 0, $j == $#p); push @out, $p[$j]; $i = $j }
    for (my $k = 1; $k < $#out; $k++) { next unless ($out[$k][0] - $out[$k - 1][0])**2 + ($out[$k][1] - $out[$k - 1][1])**2 < 64; splice @out, $k, 1; $k-- }   # merge corners closer than 8
    return \@out }
my (%RPATH, %BENT); my %ANY = map { $_ => 1 } @CORDER;
for my $e (sort keys %LAND) { my ($a, $b) = split /-/, $e; my @stops = ([ @{ $S{$a} }{qw(x y)} ], $VIA{$e} ? [ $VIA{$e}{x}, $VIA{$e}{y} ] : (), [ @{ $S{$b} }{qw(x y)} ]);
    my %allow = map { $_ => 1 } $S{$a}{country}, $S{$b}{country}, $VIA{$e} ? $S{ $VIA{$e}{owner} }{country} : ();
    my @path = ($stops[0]);
    for my $i (1 .. $#stops) { my ($p, $q) = @stops[$i - 1, $i];
        if (leg_ok($p, $q, 1, 0, \%allow, 1, 1)) { push @path, $q; next }
        my $why = leg_ok($p, $q, 1, 0, \%ANY, 1, 1) ? 'country' : 'sea';
        my $bent = land_path($p, $q, \%allow, $ROUTE_MARGIN); if (!$bent && ($bent = land_path($p, $q, \%allow, 0))) { $BENT{tight}{$e} = 1 }
        unless ($bent) { warn "route $e: no way over land of " . join('/', sort keys %allow) . " only; drawn straight\n"; push @path, $q; next }
        push @path, @{ $bent }[1 .. $#$bent]; $BENT{$why}{$e} = 1 }
    for my $i (1 .. $#path) { warn "route $e still leaves its countries near " . join(',', map { int } @{ $path[$i] }) . "\n" unless leg_ok($path[$i - 1], $path[$i], 1, 0, \%allow, 1, 1) }
    $RPATH{$e} = \@path }
$RPATH{$_} = [ map { [ @{ $S{$_} }{qw(x y)} ] } split /-/ ] for keys %STRAIT;
# route segments: [x1, y1, x2, y2, key, strait]
my @ROUTESEG = map { my $e = $_; my $p = $RPATH{$e}; map { [ @{ $p->[$_ - 1] }, @{ $p->[$_] }, $e, $STRAIT{$e} ? 1 : 0 ] } 1 .. $#$p } sort keys %RPATH;

occ_line($_, 1.0) for chains(@COAST); occ_line($_, 1.25) for map { chains(@{ $PAIR{$_} }) } grep { my ($a, $b) = split /-/; $S{$a}{country} ne $S{$b}{country} } keys %PAIR;
occ_line($_, 1.25) for @RIVERS; occ_seg(@$_[0 .. 3], 1.0) for @ROUTESEG;
for my $s (values %S) { occ_box($s->{x} - 11, $s->{y} - 11, $s->{x} + 10, $s->{y} + 10) }
for my $p (@PASSES) { occ_box($p->{x} - 11, $p->{y} - 13, $p->{x} + 11, $p->{y} + 7) }
occ_box(0, 0, $W - 1, 1); occ_box(0, $H - 2, $W - 1, $H - 1); occ_box(0, 0, 1, $H - 1); occ_box($W - 2, 0, $W - 1, $H - 1);

# ---------- mountains: each needs clear space all round, inside its starting country ----------
my @DIST = map { [ (1e9) x $W ] } 1 .. $H; my @DQ; my @N4 = ([1, 0], [-1, 0], [0, 1], [0, -1]);
sub obstacle { my ($x, $y) = @_; return unless inb($x, $y) && $DIST[$y][$x]; $DIST[$y][$x] = 0; push @DQ, [$x, $y] }
sub spread { while (@DQ) { my @n; for my $c (@DQ) { my $d = $DIST[ $c->[1] ][ $c->[0] ] + 1; next if $d > 12;
    for (@N4) { my ($u, $v) = ($c->[0] + $_->[0], $c->[1] + $_->[1]); next unless inb($u, $v) && $DIST[$v][$u] > $d; $DIST[$v][$u] = $d; push @n, [$u, $v] } } @DQ = @n } }
for my $y (0 .. $H - 1) { for my $x (0 .. $W - 1) { obstacle($x, $y) if $OCC[$y][$x] || !$REG[$y][$x] } }
spread();
sub mtn_inside { my ($ax, $ay, $x, $y, $grow) = @_; my ($hw, $h) = ($MTN_W / 2, $MTN_H);
    return 0 if $y > $ay + $h + $grow || $y < $ay - $grow * 2; return abs($x - $ax) <= $hw * ($y - $ay) / $h + $grow * (1 + $hw / $h) }
my @OUTLINE;                             # sample points just outside the symbol, relative to the apex
{ my ($hw, $h) = ($MTN_W / 2, $MTN_H); my @v = ([0, -1.5], [-$hw - 1.5, $h + 1.2], [$hw + 1.5, $h + 1.2]);
  for my $i (0 .. 2) { my ($a, $b) = ($v[$i], $v[($i + 1) % 3]); my $n = int(sqrt(($b->[0] - $a->[0])**2 + ($b->[1] - $a->[1])**2));
      push @OUTLINE, map { [ $a->[0] + ($b->[0] - $a->[0]) * $_ / $n, $a->[1] + ($b->[1] - $a->[1]) * $_ / $n ] } 0 .. $n - 1 }
  push @OUTLINE, [0, $h * 0.66], [-$hw / 2, $h * 0.85], [$hw / 2, $h * 0.85], [0, $h * 0.3] }
sub mtn_clear { my ($ax, $ay) = @_; for my $s (@OUTLINE) { my ($x, $y) = (int($ax + $s->[0]), int($ay + $s->[1])); return 0 if !inb($x, $y) || $DIST[$y][$x] < $MTN_GAP } 1 }
sub country_at { my ($x, $y) = map { int } @_; return '' unless inb($x, $y); my $id = $REG[$y][$x]; $id ? $S{$id}{country} : '' }
my @offsets = ([0, 0, 0]);
if ($MODE eq 'mountains') { @offsets = sort { $a->[2] <=> $b->[2] } grep { $_->[2] <= $MTN_REACH**2 } map { my $dy = $_; map { [$_, $dy, $_ * $_ + $dy * $dy] } -$MTN_REACH .. $MTN_REACH } -$MTN_REACH .. $MTN_REACH }
my (@placed, @touching, @dropped);
for my $pk (sort { $a->[1] <=> $b->[1] || $a->[0] <=> $b->[0] } @PEAKS) { my ($px, $py) = @$pk; my $home = country_at($px, $py + $MTN_H * 0.66);
    my ($spot) = map { [ $px + $_->[0], $py + $_->[1] ] } grep { my ($ax, $ay) = ($px + $_->[0], $py + $_->[1]); country_at($ax, $ay + $MTN_H * 0.66) eq $home && mtn_clear($ax, $ay) } @offsets;
    if (!$spot) { if ($MODE eq 'mountains') { push @dropped, $pk; next } push @touching, $pk; $spot = $pk }
    push @placed, $spot; my ($ax, $ay) = @$spot;
    for my $y (int($ay) - 3 .. int($ay + $MTN_H) + 3) { for my $x (int($ax - $MTN_W / 2) - 3 .. int($ax + $MTN_W / 2) + 3) {
        next unless inb($x, $y) && mtn_inside($ax, $ay, $x + 0.5, $y + 0.5, 1.0); obstacle($x, $y); $OCC[$y][$x] = 1 } }
    spread() }
@placed = sort { $a->[1] <=> $b->[1] || $a->[0] <=> $b->[0] } @placed;

# ---------- country codes, each in the clearest spot of its land (or the sea next to it) ----------
my @LABELS;
{ my $sat = sub { my $f = shift; my @t = map { [ (0) x ($W + 1) ] } 0 .. $H;      # summed-area table
      for my $y (0 .. $H - 1) { for my $x (0 .. $W - 1) { $t[$y + 1][$x + 1] = $f->($x, $y) + $t[$y][$x + 1] + $t[$y + 1][$x] - $t[$y][$x] } } \@t };
  my $onland = $sat->(sub { $OCC[$_[1]][$_[0]] || !$REG[ $_[1] ][ $_[0] ] ? 1 : 0 }); my $anywhere = $sat->(sub { $OCC[$_[1]][$_[0]] });
  my $busy = sub { my ($t, $x0, $y0, $x1, $y1) = @_; ($x0, $y0, $x1, $y1) = map { int } ($x0, $y0, $x1, $y1); return 1 if $x0 < 0 || $y0 < 0 || $x1 >= $W || $y1 >= $H;
      $t->[$y1 + 1][$x1 + 1] - $t->[$y0][$x1 + 1] - $t->[$y1 + 1][$x0] + $t->[$y0][$x0] };
  my (%land, %near);
  for my $y (grep { $_ % 2 == 0 } 0 .. $H - 1) { for my $x (grep { $_ % 2 == 0 } 0 .. $W - 1) { my $id = $REG[$y][$x]; push @{ $land{ $S{$id}{country} } }, [$x, $y] if $id } }
  for my $id (sort { $a <=> $b } keys %S) { my ($sx, $sy) = @{ $S{$id} }{qw(x y)};
      for (my $y = $sy - 40; $y <= $sy + 40; $y += 2) { for (my $x = $sx - 40; $x <= $sx + 40; $x += 2) { push @{ $near{ $S{$id}{country} } }, [$x, $y] } } }
  for my $c (@CORDER) { my $best;
      for my $try ([15, \%land, $onland], [10, \%land, $onland], [15, \%near, $anywhere], [10, \%near, $anywhere]) { my ($size, $pts, $t) = @$try;
          my ($tw, $th) = ($CHAR_W * $size * length($c), $CHAR_W * $size); my $m = $size / 5;
          for my $pt (@{ $pts->{$c} // [] }) { my ($x0, $y0, $x1, $y1) = ($pt->[0] - $tw / 2 - $m, $pt->[1] - $th / 2 - $m, $pt->[0] + $tw / 2 + $m, $pt->[1] + $th / 2 + $m);
              next if $busy->($t, $x0, $y0, $x1, $y1) || grep { $x0 <= $_->[2] && $x1 >= $_->[0] && $y0 <= $_->[3] && $y1 >= $_->[1] } @LABELS;
              my $room = 0; $room++ while $room < 40 && !$busy->($t, $x0 - $room, $y0 - $room, $x1 + $room, $y1 + $room);
              $best = [$x0, $y0, $x1, $y1, $size, $room, @$pt, $th] if !$best || $room > $best->[5] }
          last if $best }
      if ($best) { push @LABELS, [ @$best, $c ] } else { warn "no room for the label of country $c\n" } } }

# ---------- rivers and routes ----------
sub cross { my ($a, $b, $c, $d) = @_; my $o = sub { my ($p, $q, $r) = @_; ($q->[0] - $p->[0]) * ($r->[1] - $p->[1]) - ($q->[1] - $p->[1]) * ($r->[0] - $p->[0]) };
    my ($d1, $d2, $d3, $d4) = ($o->($c, $d, $a), $o->($c, $d, $b), $o->($a, $b, $c), $o->($a, $b, $d)); ($d1 > 0) != ($d2 > 0) && ($d3 > 0) != ($d4 > 0) }
sub seg_dist { my ($px, $py, $a, $b) = @_; my ($dx, $dy) = ($b->[0] - $a->[0], $b->[1] - $a->[1]); my $L2 = $dx * $dx + $dy * $dy;
    my $t = $L2 ? (($px - $a->[0]) * $dx + ($py - $a->[1]) * $dy) / $L2 : 0; $t = $t < 0 ? 0 : $t > 1 ? 1 : $t; sqrt(($px - $a->[0] - $t * $dx)**2 + ($py - $a->[1] - $t * $dy)**2) }
my @RSEG = map { my $r = $_; map { [ $r->[$_ - 1], $r->[$_] ] } 1 .. $#$r } @RIVERS;
my %CROSS; for my $s (grep { !$_->[5] } @ROUTESEG) { $CROSS{ $s->[4] } = 1 if grep { cross([ @$s[0, 1] ], [ @$s[2, 3] ], @$_) } @RSEG }
for my $id (keys %S) { my $s = $S{$id}; $s->{river} = (grep { seg_dist($s->{x}, $s->{y}, @$_) <= $RIVER_NEAR } @RSEG) ? 1 : 0 }

# =====================================================================================
# map.svg
# =====================================================================================
sub n { my $v = sprintf '%.2f', shift; $v =~ s/\.?0+$//; $v eq '-0' ? 0 : $v }
sub d_line { 'M' . join(' L', map { n($_->[0]) . ' ' . n($_->[1]) } @{ $_[0] }) }
sub d_rings { join ' ', map { d_line($_) . ' Z' } @{ $_[0] } }
sub esc { my $s = shift; $s =~ s/&/&amp;/g; $s =~ s/</&lt;/g; $s =~ s/"/&quot;/g; $s }
my @o;
push @o, qq{<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 $W $H" width="$W" height="$H" font-family="Arial, Helvetica, sans-serif">},
    '<!-- Generated by tools/map.pl from docs/SCENARIO.md and docs/map-base.svg. Do not edit: change those and rerun. -->', "<style>\n$STYLE</style>",
    qq{<rect id="sea" class="sea" width="$W" height="$H"/>}, 
    sprintf('<path id="landmass" class="landmass" d="%s"/>', join ' ', map { d_rings($LANDS{$_}) } sort { $a <=> $b } keys %LANDS),      # under the lands: hides hairline seams between them
    '<g id="lands">';
push @o, sprintf '  <path id="land-%d" class="land %s" d="%s"/>', $_, $S{$_}{country}, d_rings($LANDS{$_}) for sort { $a <=> $b } keys %LANDS;
push @o, '</g>', '<g id="edges">', sprintf('  <path id="frame" class="frame" d="%s"/>', join ' ', map { d_line($_) } chains(@FRAME)),
    sprintf('  <path id="coast" class="coast" d="%s"/>', join ' ', map { d_line($_) } chains(@COAST));
for my $k (sort { my @a = split /-/, $a; my @b = split /-/, $b; $a[0] <=> $b[0] || $a[1] <=> $b[1] } keys %PAIR) { my ($a, $b) = split /-/, $k;
    push @o, sprintf '  <path id="edge-%s" class="edge %s" d="%s"/>', $k, $S{$a}{country} eq $S{$b}{country} ? 'province' : 'border', join ' ', map { d_line($_) } chains(@{ $PAIR{$k} }) }
push @o, '</g>', '<g id="rivers">', (map { sprintf '  <path class="river" d="%s"/>', d_line($_) } @RIVERS), '</g>', '<g id="routes">';
for my $e (sort { my @a = split /-/, $a; my @b = split /-/, $b; $a[0] <=> $b[0] || $a[1] <=> $b[1] } keys %LAND, keys %STRAIT) { my ($a, $b) = split /-/, $e;
    push @o, sprintf '  <path id="route-%s" class="route%s" d="%s"/>', $e, $STRAIT{$e} ? ' strait' : '', d_line($RPATH{$e}) }
push @o, '</g>', '<g id="mountains">';
for my $m (@placed) { my ($ax, $ay) = @$m; my ($hw, $h) = ($MTN_W / 2, $MTN_H); my $sx = $ax + $MTN_W * 0.06; my $sy = $ay + $h * 0.34; my $sw = $hw * 0.34;
    my $pts = sub { join ' ', map { n($_->[0]) . ',' . n($_->[1]) } @_ };
    push @o, '  <g class="mountain">',
        sprintf('    <polygon class="mtn-lit" points="%s"/>', $pts->([$ax, $ay], [$ax - $hw, $ay + $h], [$sx, $ay + $h])),
        sprintf('    <polygon class="mtn-shade" points="%s"/>', $pts->([$ax, $ay], [$sx, $ay + $h], [$ax + $hw, $ay + $h])),
        sprintf('    <polygon class="mtn-snow" points="%s"/>', $pts->([$ax, $ay], [$ax - $sw, $sy], [$ax - $sw * 0.5, $sy + 1.5], [$ax + 0.6, $sy + 0.2])),
        sprintf('    <polygon class="mtn-snow-shade" points="%s"/>', $pts->([$ax, $ay], [$ax + 0.6, $sy + 0.2], [$ax + $sw * 0.55, $sy + 1.3], [$ax + $sw, $sy])),
        sprintf('    <polygon class="mtn-outline" points="%s"/>', $pts->([$ax, $ay], [$ax - $hw, $ay + $h], [$ax + $hw, $ay + $h])), '  </g>' }
push @o, '</g>', '<g id="passes">';
for my $p (@PASSES) { my $h = $PASS_SIDE * sqrt(3) / 2; my ($x, $y) = @$p{qw(x y)};
    push @o, sprintf '  <polygon id="pass-%s" class="pass" points="%s,%s %s,%s %s,%s"/>', $p->{id}, n($x), n($y - 2 * $h / 3), n($x - $PASS_SIDE / 2), n($y + $h / 3), n($x + $PASS_SIDE / 2), n($y + $h / 3) }
push @o, '</g>', '<g id="settlements">';
for my $id (sort { $a <=> $b } keys %S) { my $s = $S{$id}; my ($x, $y) = @$s{qw(x y)};
    push @o, sprintf '  <g id="settlement-%d" class="settlement %s %s">%s<text class="number" x="%s" y="%s">%d</text></g>', $id, $s->{city} ? 'city' : 'town', $s->{country},
        $s->{city} ? sprintf('<rect class="marker" x="%s" y="%s" width="%d" height="%d"/>', $x - $CITY_SIDE / 2, $y - $CITY_SIDE / 2, $CITY_SIDE, $CITY_SIDE)
                   : sprintf('<circle class="marker" cx="%s" cy="%s" r="%d"/>', $x, $y, $TOWN_R), $x, n($y + 3.5), $id }
push @o, '</g>', '<g id="labels">';
push @o, sprintf '  <text id="label-%s" class="label%s" x="%s" y="%s">%s</text>', $_->[9], $_->[4] < 15 ? ' small' : '', n($_->[6]), n($_->[7] + $_->[8] / 2), $_->[9] for @LABELS;
push @o, '</g>', '</svg>';
open $fh, '>', $SVG or die "$SVG: $!"; print $fh map { "$_\n" } @o; close $fh;

# =====================================================================================
# derived numbers, scenario.json, SCENARIO.md
# =====================================================================================
sub fmt { my $n = shift; 1 while $n =~ s/^(\d+)(\d{3})/$1,$2/; $n }
sub ranges { my @n = sort { $a <=> $b } @_; my @r;
    while (@n) { my $a = shift @n; my $b = $a; $b = shift @n while @n && $n[0] == $b + 1; push @r, $b == $a ? $a : $b == $a + 1 ? "$a, $b" : "$a–$b" } join ', ', @r }
my %C;                                   # country -> { ids pop ports hre }
for my $id (sort { $a <=> $b } keys %S) { my $s = $S{$id}; my $c = $C{ $s->{country} } //= { ids => [], pop => 0, ports => [], hre => 0 };
    $s->{pop} = $s->{city} ? 20000 : 10000; push @{ $c->{ids} }, $id; $c->{pop} += $s->{pop}; push @{ $c->{ports} }, $id if $s->{port}; $c->{hre}++ if $s->{hre} }
for my $c (values %C) { $c->{army} = $c->{pop} / 25; $c->{ships} = @{ $c->{ports} } ? $c->{pop} / 2000 : 0; $c->{hrestate} = $c->{hre} == @{ $c->{ids} } ? 'all' : $c->{hre} ? 'part' : 'none' }
sub cname { "$_[0] $CN{$_[0]}" }
my @ids = sort { $a <=> $b } keys %S;
sub bykey { my @a = split /-/, $a; my @b = split /-/, $b; $a[0] <=> $b[0] || $a[1] <=> $b[1] }

my ($T, $F) = (JSON::PP::true, JSON::PP::false);
my %json = (
    source => 'Generated by tools/map.pl from docs/SCENARIO.md and docs/map-base.svg. Do not edit.',
    map => { svg => 'map.svg', width => 0 + $W, height => 0 + $H },
    countries => [ map { my $c = $C{$_}; { code => $_, name => $CN{$_}, settlements => [ map { 0 + $_ } @{ $c->{ids} } ], pop => $c->{pop}, army => $c->{army}, ships => $c->{ships}, hre => $c->{hrestate} } } @CORDER ],
    settlements => [ map { my $s = $S{$_}; { id => 0 + $_, name => $s->{name}, country => $s->{country}, type => $s->{city} ? 'city' : 'town', pop => $s->{pop},
        port => $s->{port} ? $T : $F, river => $s->{river} ? $T : $F, hre => $s->{hre} ? $T : $F, x => 0 + $s->{x}, y => 0 + $s->{y}, land => "land-$_",
        borders => [ sort { $a <=> $b } map { 0 + $_ } @{ $s->{nb} } ], straits => [ sort { $a <=> $b } map { 0 + $_ } @{ $s->{st} } ] } } @ids ],
    routes => [ map { my ($a, $b) = split /-/; { id => "route-$_", from => 0 + $a, to => 0 + $b, type => $STRAIT{$_} ? 'strait' : 'land',
        pass => $VIA{$_} ? $VIA{$_}{id} : undef, crossesRiver => $CROSS{$_} ? $T : $F, points => [ map { [ map { 0 + n($_) } @$_ ] } @{ $RPATH{$_} } ] } } sort bykey keys %LAND, keys %STRAIT ],
    passes => [ map { { id => $_->{id}, x => 0 + $_->{x}, y => 0 + $_->{y}, routes => $_->{routes}, land => 0 + $_->{owner} } } @PASSES ],
);
open $fh, '>:raw', $JSON or die "$JSON: $!"; print $fh JSON::PP->new->utf8->canonical->pretty->indent_length(1)->encode(\%json); close $fh;

{ my ($h, $rows, $i, $j) = table('Countries');
  my @t = ('| Code | Country | Settlements | Pop | Army | Ships | HRE |', '|---|---|---|---|---|---|---|');
  for my $k (@CORDER) { my $c = $C{$k};
      push @t, sprintf '| %s | %s | %s | %dK | %s | %s | %s |', $k, $CN{$k}, join(', ', @{ $c->{ids} }), $c->{pop} / 1000, fmt($c->{army}), $c->{ships} || '—', { all => '✓', part => 'part', none => '—' }->{ $c->{hrestate} } }
  splice @doc, $i, $j - $i + 1, @t }
{ my ($h, $rows, $i, $j) = table('Mountain passes');
  my @t = ('| Pass | X | Y | Routes | In the land of | Owner at start |', '|---|---|---|---|---|---|');
  push @t, sprintf '| %s | %d | %d | %s | %s | %s |', $_->{id}, $_->{x}, $_->{y}, join(', ', @{ $_->{routes} }), "$_->{owner} $S{ $_->{owner} }{name}", cname($S{ $_->{owner} }{country}) for @PASSES;
  splice @doc, $i, $j - $i + 1, @t }
if ($MODE eq 'mountains') { my ($s, $e) = section('Mountains'); my ($f, $t) = grep { $doc[$_] =~ /^```/ } $s .. $e; my @p = @placed;
    my @l; push @l, join '  ', map { "$_->[0],$_->[1]" } splice @p, 0, 8 while @p; splice @doc, $f + 1, $t - $f - 1, @l }
sub generated { my ($name, @body) = @_; my ($s) = grep { $doc[$_] eq "<!-- generated:$name -->" } 0 .. $#doc; die "SCENARIO.md: no <!-- generated:$name --> marker\n" unless defined $s;
    my $e = $s + 1; $e++ while $e <= $#doc && $doc[$e] ne '<!-- /generated -->'; die "SCENARIO.md: <!-- generated:$name --> is not closed\n" if $e > $#doc;
    splice @doc, $s + 1, $e - $s - 1, @body }
my @cities = grep { $S{$_}{city} } @ids; my $pop = 0; $pop += $_->{pop} for values %C;
my %ord; @ord{@CORDER} = 0 .. $#CORDER;
my @naval = sort { $C{$b}{ships} <=> $C{$a}{ships} || $ord{$a} <=> $ord{$b} } grep { $C{$_}{ships} } @CORDER; my $ships = 0; $ships += $C{$_}{ships} for @naval;
generated('summary', sprintf('%d settlements (%d cities, %d towns) · %d countries · %s people · %d land routes, %d straits, %d mountain passes',
    scalar @ids, scalar @cities, @ids - @cities, scalar @CORDER, fmt($pop), scalar keys %LAND, scalar keys %STRAIT, scalar @PASSES));
my %bypop; push @{ $bypop{ $C{$_}{pop} } }, $_ for @CORDER;
my @hre = grep { $S{$_}{hre} } @ids; my @hrec = grep { $C{$_}{hre} } @CORDER; my @onriver = grep { $S{$_}{river} } @ids; my @crossing = sort bykey keys %CROSS;
generated('overview',
    "**Cities (20K):** " . join(', ', @cities) . " — all other settlements are towns (10K).", '',
    sprintf("**HRE settlements (%d):** %s — held by %d of the %d countries.", scalar @hre, ranges(@hre), scalar @hrec, scalar @CORDER), '',
    sprintf("**Ports (%d):** %s", scalar(grep { $S{$_}{port} } @ids), join(', ', grep { $S{$_}{port} } @ids)), '',
    sprintf("**On a river (%d):** %s — within %dpx of a river on the map; grow +0.5%% (RULES.md §2).", scalar @onriver, join(', ', @onriver), $RIVER_NEAR), '',
    sprintf("**Routes crossing a river (%d):** %s — +2 months to march (RULES.md §8).", scalar @crossing, join(', ', @crossing)), '',
    '| Pop | Countries |', '|---|---|',
    (map { sprintf '| %dK | %d: %s |', $_ / 1000, scalar @{ $bypop{$_} }, join(' · ', map { cname($_) } @{ $bypop{$_} }) } sort { $b <=> $a } keys %bypop), '',
    sprintf('**Naval powers:** %d countries, %d ships. Crossing a strait needs 10 ships (RULES.md §8).', scalar @naval, $ships), '',
    '| Country | Ports held | Ships | Can cross straits? |', '|---|---|---|---|',
    (map { sprintf '| %s | %s | %d | %s |', cname($_), join(', ', @{ $C{$_}{ports} }), $C{$_}{ships}, $C{$_}{ships} > 10 ? 'yes' : $C{$_}{ships} == 10 ? '**exactly**' : 'no' } @naval));
open $fh, '>', $DOC or die "$DOC: $!"; print $fh map { "$_\n" } @doc; close $fh;

# ---------- report ----------
printf "%d settlements, %d countries, %d land routes (%d cross a river), %d straits, %d passes, %d mountains, %d rivers -> docs/map.svg, docs/scenario.json\n",
    scalar @ids, scalar @CORDER, scalar keys %LAND, scalar @crossing, scalar keys %STRAIT, scalar @PASSES, scalar @placed, scalar @RIVERS;
printf "%s at %d,%d: land of %d %s (%s)\n", $_->{id}, $_->{x}, $_->{y}, $_->{owner}, $S{ $_->{owner} }{name}, cname($S{ $_->{owner} }{country}) for @PASSES;
printf "bent around the sea: %s\n", join(', ', sort bykey keys %{ $BENT{sea} }) if $BENT{sea};
printf "bent around other countries: %s\n", join(', ', sort bykey keys %{ $BENT{country} }) if $BENT{country};
printf "squeezed through a point where the lands barely touch: %s\n", join(', ', sort bykey keys %{ $BENT{tight} }) if $BENT{tight};
if (@touching) { warn sprintf "%d mountain(s) touch something: %s -- run `perl tools/map.pl mountains`\n", scalar @touching, join ' ', map { "$_->[0],$_->[1]" } @touching }
if ($MODE eq 'mountains') { my $moved = grep { my $q = $_; !grep { $_->[0] == $q->[0] && $_->[1] == $q->[1] } @PEAKS } @placed;
    printf "mountains: %d kept, %d moved, %d dropped%s\n", @placed - $moved, $moved, scalar @dropped, @dropped ? ' (no clear spot near ' . join(' ', map { "$_->[0],$_->[1]" } @dropped) . ')' : '' }
