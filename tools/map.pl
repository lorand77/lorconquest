#!/usr/bin/perl
# Draw docs/map.png from docs/SCENARIO.md (the single source of map data) on top of docs/map-base.png
# (the hand-drawn sea, coast, borders and rivers), and refresh the generated parts of SCENARIO.md.
#
#   perl tools/map.pl              check the data, redraw map.png, refresh SCENARIO.md
#   perl tools/map.pl mountains    the same, but first move any mountain that touches something
#
# Only core Perl is needed.
use strict; use warnings; use utf8; use open qw(:std :encoding(UTF-8));
use File::Basename qw(dirname); use Cwd qw(abs_path); use Compress::Zlib;

my $ROOT = dirname(dirname(abs_path(__FILE__)));
my ($DOC, $BASE, $OUT) = map { "$ROOT/docs/$_" } qw(SCENARIO.md map-base.png map.png);
my $MODE = shift // 'draw'; die "usage: $0 [mountains]\n" unless $MODE =~ /^(draw|mountains)$/;

# ---------- look ----------
my @SEA = (153, 217, 234); my @BORDER = (127, 127, 127); my @RIVER = (0, 162, 232);
my @RED = (201, 22, 31);                 # towns (circle r=9) and cities (22px square)
my @LINE = (190, 190, 190);              # connections; straits dashed
my @PASS = (255, 230, 0); my $PASS_SIDE = 20;
my @LABEL = (70, 70, 70);                # country codes
my ($MTN_W, $MTN_H) = (30, 26);
my @MTN_OUT = (95, 65, 40); my @MTN_LIT = (196, 170, 136); my @MTN_SHADE = (150, 118, 86);
my @MTN_SNOW = (252, 252, 252); my @MTN_SNOWS = (214, 220, 228);
my ($MTN_GAP, $MTN_REACH) = (5, 40);     # clear space around a mountain; how far `mountains` may move one

# =====================================================================================
# SCENARIO.md
# =====================================================================================
open my $fh, '<', $DOC or die "$DOC: $!"; my @doc = <$fh>; close $fh; chomp @doc;
my @ERR; sub err { push @ERR, sprintf(shift, @_) }

sub section { my $t = shift; my ($s) = grep { $doc[$_] =~ /^## \Q$t\E\s*$/ } 0 .. $#doc; die "SCENARIO.md: no '## $t' section\n" unless defined $s;
    my $e = $s + 1; $e++ while $e <= $#doc && $doc[$e] !~ /^#{1,2} /; return ($s, $e - 1) }
sub cells { my $l = shift; $l =~ s/^\s*\|//; $l =~ s/\|\s*$//; map { my $c = $_; $c =~ s/\*\*//g; $c =~ s/^\s+|\s+$//g; $c } split /\|/, $l, -1 }
# table($section) -> (\@header, \@rows as hashes, first line, last line)
sub table { my ($s, $e) = section(shift); my $i = $s; $i++ while $i <= $e && $doc[$i] !~ /^\|/; die "SCENARIO.md: no table under '$doc[$s]'\n" if $i > $e;
    my @h = cells($doc[$i]); my $j = $i + 2; my @rows;
    while ($j <= $#doc && $doc[$j] =~ /^\|/) { my @c = cells($doc[$j]); my %r; @r{@h} = @c; $r{_line} = $j + 1; push @rows, \%r; $j++ }
    return (\@h, \@rows, $i, $j - 1) }
sub ids { my $s = shift // ''; grep { /\S/ } split /\s*,\s*/, $s }

my (%CN, @CORDER);                       # country code -> name, in table order
{ my (undef, $rows) = table('Countries');
  for my $r (@$rows) { my ($c, $n) = @$r{qw(Code Country)}; err("Countries line %d: duplicate code %s", $r->{_line}, $c) if $CN{$c}; $CN{$c} = $n; push @CORDER, $c } }

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

my @PEAKS; my ($MTN_FROM, $MTN_TO);      # the ``` block under ## Mountains
{ my ($s, $e) = section('Mountains'); my @f = grep { $doc[$_] =~ /^```/ } $s .. $e; die "SCENARIO.md: no ``` block under ## Mountains\n" unless @f >= 2;
  ($MTN_FROM, $MTN_TO) = @f[0, 1]; for my $i ($MTN_FROM + 1 .. $MTN_TO - 1) { push @PEAKS, [ $1, $2 ] while $doc[$i] =~ /(\d+),(\d+)/g } }

die "SCENARIO.md has errors:\n" . join('', map { "  $_\n" } @ERR) if @ERR;

# =====================================================================================
# picture
# =====================================================================================
my ($W, $H, $B) = load_png($BASE);
sub inb { $_[0] >= 0 && $_[1] >= 0 && $_[0] < $W && $_[1] < $H }
sub rgb { my ($img, $x, $y) = @_; my $p = $img->[$y][$x]; ($p->[0], $p->[1], $p->[2]) }
sub is_white { my ($r, $g, $b) = @_; $r == 255 && $g == 255 && $b == 255 }
sub is_sea   { my ($r, $g, $b) = @_; $r == $SEA[0] && $g == $SEA[1] && $b == $SEA[2] }
sub is_gray  { my ($r, $g, $b) = @_; $r == $g && $g == $b && $r >= 100 && $r <= 215 }
sub is_black { my ($r, $g, $b) = @_; $r < 70 && $g < 70 && $b < 70 }
sub is_river { my ($r, $g, $b) = @_; $b > 150 && $r < 120 && !is_sea($r, $g, $b) }
my @N4 = ([1, 0], [-1, 0], [0, 1], [0, -1]);
for my $id (sort { $a <=> $b } keys %S) { my $s = $S{$id}; err("settlement %d (%d,%d) is off the map", $id, $s->{x}, $s->{y}) unless inb($s->{x}, $s->{y}) }
for my $p (@PASSES) { err("pass %s (%d,%d) is off the map", $p->{id}, $p->{x}, $p->{y}) unless inb($p->{x}, $p->{y}) }
die "SCENARIO.md has errors:\n" . join('', map { "  $_\n" } @ERR) if @ERR;

# marker footprint: pixel -> settlement id
my %MK;
for my $id (keys %S) { my ($cx, $cy) = @{ $S{$id} }{qw(x y)};
    if ($S{$id}{city}) { for my $y ($cy - 11 .. $cy + 10) { for my $x ($cx - 11 .. $cx + 10) { $MK{"$x,$y"} = $id } } }
    else { for my $y ($cy - 11 .. $cy + 11) { for my $x ($cx - 11 .. $cx + 11) { $MK{"$x,$y"} = $id if ($x + 0.5 - $cx)**2 + ($y + 0.5 - $cy)**2 <= 9.5**2 } } } }

# provinces: areas walled in by borders, coast and sea (rivers do not split them)
my %WALL;
for my $y (0 .. $H - 1) { for my $x (0 .. $W - 1) { my @c = rgb($B, $x, $y); $WALL{"$x,$y"} = 1 if is_sea(@c) || is_black(@c) || is_gray(@c) } }
for my $y (0 .. $H - 1) { for my $x (0 .. $W - 1) { next unless is_river(rgb($B, $x, $y));     # a river running along a border is still a border
    for my $d ([1, 0], [0, 1], [1, 1], [1, -1]) { my ($f, $b) = (0, 0);
        for my $k (1 .. 4) { $f ||= inb($x + $d->[0] * $k, $y + $d->[1] * $k) && is_gray(rgb($B, $x + $d->[0] * $k, $y + $d->[1] * $k));
                             $b ||= inb($x - $d->[0] * $k, $y - $d->[1] * $k) && is_gray(rgb($B, $x - $d->[0] * $k, $y - $d->[1] * $k)) }
        if ($f && $b) { $WALL{"$x,$y"} = 1; last } } } }
my @PROV = map { [ (0) x $W ] } 1 .. $H; my $NPROV = 0;
for my $y (0 .. $H - 1) { for my $x (0 .. $W - 1) { next if $PROV[$y][$x] || $WALL{"$x,$y"}; $NPROV++; my @s = ([$x, $y]); $PROV[$y][$x] = $NPROV;
    while (my $e = pop @s) { for (@N4) { my ($u, $v) = ($e->[0] + $_->[0], $e->[1] + $_->[1]);
        next if !inb($u, $v) || $PROV[$v][$u] || $WALL{"$u,$v"}; $PROV[$v][$u] = $NPROV; push @s, [$u, $v] } } } }
sub prov_near { my ($x, $y) = @_; for my $r (0 .. 8) { for my $dy (-$r .. $r) { for my $dx (-$r .. $r) { my ($u, $v) = ($x + $dx, $y + $dy);
    return $PROV[$v][$u] if inb($u, $v) && $PROV[$v][$u] } } } 0 }

# owner of each pass: the settlement whose land it lies in (nearest marker without crossing a border)
for my $p (@PASSES) { my ($sx, $sy) = ($p->{x}, $p->{y});
    if ($WALL{"$sx,$sy"}) { my $bd = 1e9; my @to; for my $dy (-6 .. 6) { for my $dx (-6 .. 6) { my $d = $dx * $dx + $dy * $dy;   # on a border line: start from the nearest open land
        ($bd, @to) = ($d, $sx + $dx, $sy + $dy) if !$WALL{ ($sx + $dx) . "," . ($sy + $dy) } && $d < $bd } } ($sx, $sy) = @to if @to }
    my %seen = ("$sx,$sy" => 1); my @q = ([$sx, $sy]); my $own = $MK{"$sx,$sy"};
    B: while (@q && !defined $own) { my @n; for my $c (@q) { for (@N4) { my ($u, $v) = ($c->[0] + $_->[0], $c->[1] + $_->[1]); my $k = "$u,$v";
        next if !inb($u, $v) || $seen{$k}++; if (defined $MK{$k}) { $own = $MK{$k}; last B } next if $WALL{$k}; push @n, [$u, $v] } } @q = @n }
    die "pass $p->{id}: cannot tell whose land it is in\n" unless defined $own; $p->{owner} = $own }

# ---------- drawing helpers ----------
my @I = map { [ map { [@$_] } @$_ ] } @$B;
sub blend { my ($x, $y, $c, $a) = @_; return unless inb($x, $y) && $a > 0; my $p = $I[$y][$x]; $I[$y][$x] = [ (map { int($c->[$_] * $a + $p->[$_] * (1 - $a) + 0.5) } 0 .. 2), 255 ] }
# capsule coverage (4x4 supersampling) of the segment x1,y1-x2,y2 with half-width hw, kept as max per pixel
sub seg_cov { my ($cov, $x1, $y1, $x2, $y2, $hw) = @_; my ($dx, $dy) = ($x2 - $x1, $y2 - $y1); my $L2 = $dx * $dx + $dy * $dy;
    for my $y (int(($y1 < $y2 ? $y1 : $y2) - $hw) - 1 .. int(($y1 > $y2 ? $y1 : $y2) + $hw) + 1) {
        for my $x (int(($x1 < $x2 ? $x1 : $x2) - $hw) - 1 .. int(($x1 > $x2 ? $x1 : $x2) + $hw) + 1) { my $n = 0;
            for my $sy (0 .. 3) { for my $sx (0 .. 3) { my ($px, $py) = ($x + ($sx + 0.5) / 4, $y + ($sy + 0.5) / 4);
                my $t = $L2 ? (($px - $x1) * $dx + ($py - $y1) * $dy) / $L2 : 0; $t = $t < 0 ? 0 : $t > 1 ? 1 : $t;
                $n++ if ($px - $x1 - $t * $dx)**2 + ($py - $y1 - $t * $dy)**2 <= $hw * $hw } }
            $cov->{"$x,$y"} = $n if $n > ($cov->{"$x,$y"} // 0) } } }
# connection segments: [x1, y1, x2, y2, dashed]; a route through a pass is two segments
sub segments { my @s;
    for my $e (sort keys %LAND) { my ($a, $b) = split /-/, $e; my @A = @{ $S{$a} }{qw(x y)}; my @Bp = @{ $S{$b} }{qw(x y)};
        if (my $p = $VIA{$e}) { my @P = ($p->{x} + 0.5, $p->{y} + 0.5); push @s, [@A, @P, 0], [@P, @Bp, 0] } else { push @s, [@A, @Bp, 0] } }
    push @s, [ @{ $S{ (split /-/)[0] } }{qw(x y)}, @{ $S{ (split /-/)[1] } }{qw(x y)}, 1 ] for sort keys %STRAIT;
    return @s }

# ---------- connections ----------
{ my %cov;
  for my $s (segments()) { my ($x1, $y1, $x2, $y2, $dashed) = @$s;
      if (!$dashed) { seg_cov(\%cov, $x1, $y1, $x2, $y2, 0.7); next }
      my $n = int(sqrt(($x2 - $x1)**2 + ($y2 - $y1)**2) / 7);
      for my $i (grep { $_ % 2 == 0 } 0 .. $n - 1) { seg_cov(\%cov, $x1 + ($x2 - $x1) * $i / $n, $y1 + ($y2 - $y1) * $i / $n, $x1 + ($x2 - $x1) * ($i + 1) / $n, $y1 + ($y2 - $y1) * ($i + 1) / $n, 0.7) } }
  for my $k (keys %cov) { my ($x, $y) = split /,/, $k; blend($x, $y, \@LINE, $cov{$k} / 16) } }

# ---------- passes: yellow triangles with a dark outline ----------
for my $p (@PASSES) { my ($cx, $cy) = ($p->{x} + 0.5, $p->{y} + 0.5); my $h = $PASS_SIDE * sqrt(3) / 2;
    my @v = ([$cx, $cy - 2 * $h / 3], [$cx - $PASS_SIDE / 2, $cy + $h / 3], [$cx + $PASS_SIDE / 2, $cy + $h / 3]);
    my $inside = sub { my ($x, $y, $grow) = @_;
        for my $i (0 .. 2) { my ($ax, $ay) = @{ $v[$i] }; my ($bx, $by) = @{ $v[($i + 1) % 3] };
            my ($nx, $ny) = ($by - $ay, -($bx - $ax)); my $nl = sqrt($nx * $nx + $ny * $ny); ($nx, $ny) = ($nx / $nl, $ny / $nl);
            ($nx, $ny) = (-$nx, -$ny) if ($cx - $ax) * $nx + ($cy - $ay) * $ny > 0;
            return 0 if ($x - $ax) * $nx + ($y - $ay) * $ny > $grow } 1 };
    for my $y (int($cy - $h) - 2 .. int($cy + $h / 2) + 2) { for my $x (int($cx - $PASS_SIDE / 2) - 2 .. int($cx + $PASS_SIDE / 2) + 2) { next unless inb($x, $y);
        my ($in, $out) = (0, 0);
        for my $sy (0 .. 3) { for my $sx (0 .. 3) { my ($px, $py) = ($x + ($sx + 0.5) / 4, $y + ($sy + 0.5) / 4); $out++ if $inside->($px, $py, 0.6); $in++ if $inside->($px, $py, -0.9) } }
        next unless $out; my ($af, $al) = ($in / 16, ($out - $in) / 16); my $q = $I[$y][$x];
        $I[$y][$x] = [ (map { int($PASS[$_] * $af + 40 * $al + $q->[$_] * (1 - $af - $al) + 0.5) } 0 .. 2), 255 ] } } }

# ---------- settlements, numbered ----------
my %FONT = map { my ($ch, @rows) = split /\//; ($ch => \@rows) } (
    '0/.###./#...#/#...#/#...#/#...#/#...#/.###.', '1/..#../.##../..#../..#../..#../..#../.###.', '2/.###./#...#/....#/...#./..#../.#.../#####',
    '3/#####/...#./..#../...#./....#/#...#/.###.', '4/...#./..##./.#.#./#..#./#####/...#./...#.', '5/#####/#..../####./....#/....#/#...#/.###.',
    '6/..##./.#.../#..../####./#...#/#...#/.###.', '7/#####/....#/...#./..#../.#.../.#.../.#...', '8/.###./#...#/#...#/.###./#...#/#...#/.###.',
    '9/.###./#...#/#...#/.####/....#/...#./.##..', 'A/.###./#...#/#...#/#####/#...#/#...#/#...#', 'B/####./#...#/#...#/####./#...#/#...#/####.',
    'C/.###./#...#/#..../#..../#..../#...#/.###.', 'D/####./#...#/#...#/#...#/#...#/#...#/####.', 'E/#####/#..../#..../####./#..../#..../#####',
    'F/#####/#..../#..../####./#..../#..../#....', 'G/.###./#...#/#..../#.###/#...#/#...#/.####', 'H/#...#/#...#/#...#/#####/#...#/#...#/#...#',
    'I/.###./..#../..#../..#../..#../..#../.###.', 'J/..###/...#./...#./...#./...#./#..#./.##..', 'K/#...#/#..#./#.#../##.../#.#../#..#./#...#',
    'L/#..../#..../#..../#..../#..../#..../#####', 'M/#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#', 'N/#...#/#...#/##..#/#.#.#/#..##/#...#/#...#',
    'O/.###./#...#/#...#/#...#/#...#/#...#/.###.', 'P/####./#...#/#...#/####./#..../#..../#....', 'Q/.###./#...#/#...#/#...#/#.#.#/#..#./.##.#',
    'R/####./#...#/#...#/####./#.#../#..#./#...#', 'S/.####/#..../#..../.###./....#/....#/####.', 'T/#####/..#../..#../..#../..#../..#../..#..',
    'U/#...#/#...#/#...#/#...#/#...#/#...#/.###.', 'V/#...#/#...#/#...#/#...#/#...#/.#.#./..#..', 'W/#...#/#...#/#...#/#.#.#/#.#.#/#.#.#/.#.#.',
    'X/#...#/#...#/.#.#./..#../.#.#./#...#/#...#', 'Y/#...#/#...#/.#.#./..#../..#../..#../..#..', 'Z/#####/....#/...#./..#../.#.../#..../#####');
sub text_size { my ($t, $s) = @_; ((length($t) * 6 - 1) * $s, 7 * $s) }
sub text { my ($t, $x0, $y0, $s, $c) = @_; my $i = 0;
    for my $ch (split //, $t) { my $g = $FONT{$ch} or die "no glyph for '$ch'\n";
        for my $r (0 .. 6) { for my $col (0 .. 4) { next unless substr($g->[$r], $col, 1) eq '#';
            for my $dy (0 .. $s - 1) { for my $dx (0 .. $s - 1) { my ($x, $y) = ($x0 + ($i * 6 + $col) * $s + $dx, $y0 + $r * $s + $dy); $I[$y][$x] = [@$c, 255] if inb($x, $y) } } } }
        $i++ } }
for my $id (sort { $a <=> $b } keys %S) { my ($cx, $cy) = @{ $S{$id} }{qw(x y)};
    if ($S{$id}{city}) { for my $y ($cy - 11 .. $cy + 10) { for my $x ($cx - 11 .. $cx + 10) { $I[$y][$x] = [@RED, 255] if inb($x, $y) } } }
    else { for my $y ($cy - 10 .. $cy + 10) { for my $x ($cx - 10 .. $cx + 10) { my $n = 0;
        for my $sy (0 .. 3) { for my $sx (0 .. 3) { $n++ if ($x + ($sx + 0.5) / 4 - $cx)**2 + ($y + ($sy + 0.5) / 4 - $cy)**2 <= 81 } } blend($x, $y, \@RED, $n / 16) } } }
    my ($tw, $th) = text_size($id, 1); text($id, $cx - int(($tw + 1) / 2), $cy - 4, 1, [255, 255, 255]) }

# ---------- mountains: each needs clear space all round ----------
my @DIST = map { [ (1e9) x $W ] } 1 .. $H; my @DQ;
sub obstacle { my ($x, $y) = @_; return unless inb($x, $y) && $DIST[$y][$x]; $DIST[$y][$x] = 0; push @DQ, [$x, $y] }
sub spread { while (@DQ) { my @n; for my $c (@DQ) { my $d = $DIST[ $c->[1] ][ $c->[0] ] + 1; next if $d > 12;
    for (@N4) { my ($u, $v) = ($c->[0] + $_->[0], $c->[1] + $_->[1]); next unless inb($u, $v) && $DIST[$v][$u] > $d; $DIST[$v][$u] = $d; push @n, [$u, $v] } } @DQ = @n } }
for my $y (0 .. $H - 1) { for my $x (0 .. $W - 1) { obstacle($x, $y) unless is_white(rgb(\@I, $x, $y)) } }
for my $x (0 .. $W - 1) { obstacle($x, 0); obstacle($x, $H - 1) } for my $y (0 .. $H - 1) { obstacle(0, $y); obstacle($W - 1, $y) }
for my $s (segments()) { my ($x1, $y1, $x2, $y2) = @$s; my $L = sqrt(($x2 - $x1)**2 + ($y2 - $y1)**2);      # lines are faint: mark their full width
    for my $i (0 .. int($L * 2)) { my $t = $L ? $i / ($L * 2) : 0; my ($x, $y) = ($x1 + ($x2 - $x1) * $t, $y1 + ($y2 - $y1) * $t);
        for my $dy (-1 .. 1) { for my $dx (-1 .. 1) { obstacle(int($x + $dx), int($y + $dy)) } } } }
spread();
sub mtn_inside { my ($ax, $ay, $x, $y, $grow) = @_; my ($hw, $h) = ($MTN_W / 2, $MTN_H);
    return 0 if $y > $ay + $h + $grow || $y < $ay - $grow * 2; return abs($x - $ax) <= $hw * ($y - $ay) / $h + $grow * (1 + $hw / $h) }
my @OUTLINE;                             # sample points just outside the symbol, relative to the apex
{ my ($hw, $h) = ($MTN_W / 2, $MTN_H); my @v = ([0, -1.5], [-$hw - 1.5, $h + 1.2], [$hw + 1.5, $h + 1.2]);
  for my $i (0 .. 2) { my ($a, $b) = ($v[$i], $v[($i + 1) % 3]); my $n = int(sqrt(($b->[0] - $a->[0])**2 + ($b->[1] - $a->[1])**2));
      push @OUTLINE, map { [ $a->[0] + ($b->[0] - $a->[0]) * $_ / $n, $a->[1] + ($b->[1] - $a->[1]) * $_ / $n ] } 0 .. $n - 1 }
  push @OUTLINE, [0, $h * 0.66], [-$hw / 2, $h * 0.85], [$hw / 2, $h * 0.85], [0, $h * 0.3] }
sub mtn_clear { my ($ax, $ay) = @_; for my $s (@OUTLINE) { my ($x, $y) = (int($ax + 0.5 + $s->[0]), int($ay + 0.5 + $s->[1])); return 0 if !inb($x, $y) || $DIST[$y][$x] < $MTN_GAP } 1 }
my @offsets = ([0, 0, 0]);
if ($MODE eq 'mountains') { @offsets = sort { $a->[2] <=> $b->[2] } grep { $_->[2] <= $MTN_REACH**2 } map { my $dy = $_; map { [$_, $dy, $_ * $_ + $dy * $dy] } -$MTN_REACH .. $MTN_REACH } -$MTN_REACH .. $MTN_REACH }
my (@placed, @touching, @dropped);
for my $pk (sort { $a->[1] <=> $b->[1] || $a->[0] <=> $b->[0] } @PEAKS) { my ($px, $py) = @$pk; my $home = prov_near($px, int($py + $MTN_H * 0.66));
    my ($spot) = map { [ $px + $_->[0], $py + $_->[1] ] } grep { my ($ax, $ay) = ($px + $_->[0], $py + $_->[1]);
        inb($ax, int($ay + $MTN_H * 0.66)) && $PROV[ int($ay + $MTN_H * 0.66) ][$ax] == $home && mtn_clear($ax, $ay) } @offsets;
    if (!$spot) { if ($MODE eq 'mountains') { push @dropped, $pk; next } push @touching, $pk; $spot = $pk }
    push @placed, $spot; my ($ax, $ay) = ($spot->[0] + 0.5, $spot->[1] + 0.5);
    for my $y (int($ay) - 3 .. int($ay + $MTN_H) + 3) { for my $x (int($ax - $MTN_W / 2) - 3 .. int($ax + $MTN_W / 2) + 3) { obstacle($x, $y) if mtn_inside($ax, $ay, $x + 0.5, $y + 0.5, 1.0) } }
    spread() }
for my $pk (sort { $a->[1] <=> $b->[1] } @placed) { my ($ax, $ay) = ($pk->[0] + 0.5, $pk->[1] + 0.5); my ($hw, $h) = ($MTN_W / 2, $MTN_H); my $split = $ax + $MTN_W * 0.06;
    for my $y (int($ay) - 3 .. int($ay + $h) + 2) { for my $x (int($ax - $hw) - 2 .. int($ax + $hw) + 2) { next unless inb($x, $y); my ($n, @acc) = (0, 0, 0, 0);
        for my $sy (0 .. 3) { for my $sx (0 .. 3) { my ($px, $py) = ($x + ($sx + 0.5) / 4, $y + ($sy + 0.5) / 4); next unless mtn_inside($ax, $ay, $px, $py, 0.9); my @c;
            if (!mtn_inside($ax, $ay, $px, $py, -0.7)) { @c = @MTN_OUT }
            else { my $t = ($py - $ay) / $h; my $lit = $px < $ax + ($split - $ax) * $t;
                @c = $t < 0.34 + 0.05 * sin(($px - $ax) * 1.3) ? ($lit ? @MTN_SNOW : @MTN_SNOWS) : ($lit ? @MTN_LIT : @MTN_SHADE) }
            $acc[$_] += $c[$_] for 0 .. 2; $n++ } }
        blend($x, $y, [ map { $_ / ($n || 1) } @acc ], $n / 16) } } }

# ---------- country codes, each in the clearest spot of its land ----------
my @LABELS;
{ my %pc;                                # province -> country (provinces holding settlements of one country only)
  for my $id (keys %S) { my $p = prov_near($S{$id}{x}, $S{$id}{y}); $pc{$p}{ $S{$id}{country} } = 1 }
  my @occ = map { [ (0) x ($W + 1) ] } 0 .. $H;      # summed-area table of occupied pixels
  for my $y (0 .. $H - 1) { for my $x (0 .. $W - 1) { $occ[$y + 1][$x + 1] = (is_white(rgb(\@I, $x, $y)) ? 0 : 1) + $occ[$y][$x + 1] + $occ[$y + 1][$x] - $occ[$y][$x] } }
  my $busy = sub { my ($x0, $y0, $x1, $y1) = @_; return 1 if $x0 < 0 || $y0 < 0 || $x1 >= $W || $y1 >= $H;
      $occ[$y1 + 1][$x1 + 1] - $occ[$y0][$x1 + 1] - $occ[$y1 + 1][$x0] + $occ[$y0][$x0] };
  my @occs = map { [ (0) x ($W + 1) ] } 0 .. $H;     # the same, but sea counts as free (fallback for small islands)
  for my $y (0 .. $H - 1) { for my $x (0 .. $W - 1) { my @c = rgb(\@I, $x, $y); $occs[$y + 1][$x + 1] = (is_white(@c) || is_sea(@c) ? 0 : 1) + $occs[$y][$x + 1] + $occs[$y + 1][$x] - $occs[$y][$x] } }
  my $busys = sub { my ($x0, $y0, $x1, $y1) = @_; return 1 if $x0 < 0 || $y0 < 0 || $x1 >= $W || $y1 >= $H;
      $occs[$y1 + 1][$x1 + 1] - $occs[$y0][$x1 + 1] - $occs[$y1 + 1][$x0] + $occs[$y0][$x0] };
  my %land; for my $y (0 .. $H - 1) { for my $x (0 .. $W - 1) { next if $x % 2 || $y % 2; my $p = $PROV[$y][$x]; next unless $p && $pc{$p} && keys %{ $pc{$p} } == 1; push @{ $land{ (keys %{ $pc{$p} })[0] } }, [$x, $y] } }
  my %near; for my $id (sort { $a <=> $b } keys %S) { my ($sx, $sy) = @{ $S{$id} }{qw(x y)};          # around its own settlements
      for (my $y = $sy - 40; $y <= $sy + 40; $y += 2) { for (my $x = $sx - 40; $x <= $sx + 40; $x += 2) { push @{ $near{ $S{$id}{country} } }, [$x, $y] } } }
  for my $c (@CORDER) { my $best;
      for my $try ([2, \%land, $busy], [1, \%land, $busy], [2, \%near, $busys], [1, \%near, $busys]) { my ($s, $pts, $bz) = @$try; my ($tw, $th) = text_size($c, $s); my $m = 3 * $s;
          for my $pt (@{ $pts->{$c} // [] }) { my ($x0, $y0) = ($pt->[0] - int($tw / 2), $pt->[1] - int($th / 2));
              next if $bz->($x0 - $m, $y0 - $m, $x0 + $tw + $m, $y0 + $th + $m);
              next if grep { $x0 - $m <= $_->[2] && $x0 + $tw + $m >= $_->[0] && $y0 - $m <= $_->[3] && $y0 + $th + $m >= $_->[1] } @LABELS;
              my $room = 0; $room++ while $room < 40 && !$bz->($x0 - $m - $room, $y0 - $m - $room, $x0 + $tw + $m + $room, $y0 + $th + $m + $room);
              $best = [$x0, $y0, $x0 + $tw - 1, $y0 + $th - 1, $s, $room] if !$best || $room > $best->[5] }
          last if $best }
      if ($best) { push @LABELS, $best; text($c, $best->[0], $best->[1], $best->[4], \@LABEL) } else { warn "no room for the label of country $c\n" } } }
save_png($OUT, $W, $H, \@I);

# =====================================================================================
# refresh SCENARIO.md
# =====================================================================================
sub fmt { my $n = shift; 1 while $n =~ s/^(\d+)(\d{3})/$1,$2/; $n }
sub ranges { my @n = sort { $a <=> $b } @_; my @r;
    while (@n) { my $a = shift @n; my $b = $a; $b = shift @n while @n && $n[0] == $b + 1; push @r, $b == $a ? $a : $b == $a + 1 ? "$a, $b" : "$a–$b" } join ', ', @r }
my %C;                                   # country -> { ids pop ports hre }
for my $id (sort { $a <=> $b } keys %S) { my $s = $S{$id}; my $c = $C{ $s->{country} } //= { ids => [], pop => 0, ports => [], hre => 0 };
    push @{ $c->{ids} }, $id; $c->{pop} += $s->{city} ? 20000 : 10000; push @{ $c->{ports} }, $id if $s->{port}; $c->{hre}++ if $s->{hre} }
for my $c (values %C) { $c->{army} = $c->{pop} / 25; $c->{ships} = @{ $c->{ports} } ? $c->{pop} / 2000 : 0 }
sub cname { "$_[0] $CN{$_[0]}" }

{ my ($h, $rows, $i, $j) = table('Countries');
  my @t = ('| Code | Country | Settlements | Pop | Army | Ships | HRE |', '|---|---|---|---|---|---|---|');
  for my $k (@CORDER) { my $c = $C{$k};
      push @t, sprintf '| %s | %s | %s | %dK | %s | %s | %s |', $k, $CN{$k}, join(', ', @{ $c->{ids} }), $c->{pop} / 1000, fmt($c->{army}),
          $c->{ships} || '—', $c->{hre} == @{ $c->{ids} } ? '✓' : $c->{hre} ? 'part' : '—' }
  splice @doc, $i, $j - $i + 1, @t }
{ my ($h, $rows, $i, $j) = table('Mountain passes');
  my @t = ('| Pass | X | Y | Routes | In the land of | Owner at start |', '|---|---|---|---|---|---|');
  push @t, sprintf '| %s | %d | %d | %s | %s | %s |', $_->{id}, $_->{x}, $_->{y}, join(', ', @{ $_->{routes} }), "$_->{owner} $S{ $_->{owner} }{name}", cname($S{ $_->{owner} }{country}) for @PASSES;
  splice @doc, $i, $j - $i + 1, @t }
if ($MODE eq 'mountains') { my ($s, $e) = section('Mountains'); my ($f, $t) = grep { $doc[$_] =~ /^```/ } $s .. $e; my @p = sort { $a->[1] <=> $b->[1] || $a->[0] <=> $b->[0] } @placed;
    my @l; push @l, join '  ', map { "$_->[0],$_->[1]" } splice @p, 0, 8 while @p; splice @doc, $f + 1, $t - $f - 1, @l }
sub generated { my ($name, @body) = @_; my ($s) = grep { $doc[$_] eq "<!-- generated:$name -->" } 0 .. $#doc; die "SCENARIO.md: no <!-- generated:$name --> marker\n" unless defined $s;
    my $e = $s + 1; $e++ while $e <= $#doc && $doc[$e] ne '<!-- /generated -->'; die "SCENARIO.md: <!-- generated:$name --> is not closed\n" if $e > $#doc;
    splice @doc, $s + 1, $e - $s - 1, @body }
my @ids = sort { $a <=> $b } keys %S; my @cities = grep { $S{$_}{city} } @ids; my $pop = 0; $pop += $_->{pop} for values %C;
my %ord; @ord{@CORDER} = 0 .. $#CORDER;
my @naval = sort { $C{$b}{ships} <=> $C{$a}{ships} || $ord{$a} <=> $ord{$b} } grep { $C{$_}{ships} } @CORDER; my $ships = 0; $ships += $C{$_}{ships} for @naval;
generated('summary', sprintf('%d settlements (%d cities, %d towns) · %d countries · %s people · %d land routes, %d straits, %d mountain passes',
    scalar @ids, scalar @cities, @ids - @cities, scalar @CORDER, fmt($pop), scalar keys %LAND, scalar keys %STRAIT, scalar @PASSES));
my %bypop; push @{ $bypop{ $C{$_}{pop} } }, $_ for @CORDER;
my @hre = grep { $S{$_}{hre} } @ids; my @hrec = grep { $C{$_}{hre} } @CORDER;
generated('overview',
    "**Cities (20K):** " . join(', ', @cities) . " — all other settlements are towns (10K).", '',
    sprintf("**HRE settlements (%d):** %s — held by %d of the %d countries.", scalar @hre, ranges(@hre), scalar @hrec, scalar @CORDER), '',
    sprintf("**Ports (%d):** %s", scalar(grep { $S{$_}{port} } @ids), join(', ', grep { $S{$_}{port} } @ids)), '',
    '| Pop | Countries |', '|---|---|',
    (map { sprintf '| %dK | %d: %s |', $_ / 1000, scalar @{ $bypop{$_} }, join(' · ', map { cname($_) } @{ $bypop{$_} }) } sort { $b <=> $a } keys %bypop), '',
    sprintf('**Naval powers:** %d countries, %d ships. Crossing a strait needs 10 ships (RULES.md §8).', scalar @naval, $ships), '',
    '| Country | Ports held | Ships | Can cross straits? |', '|---|---|---|---|',
    (map { sprintf '| %s | %s | %d | %s |', cname($_), join(', ', @{ $C{$_}{ports} }), $C{$_}{ships}, $C{$_}{ships} > 10 ? 'yes' : $C{$_}{ships} == 10 ? '**exactly**' : 'no' } @naval));
open $fh, '>', $DOC or die "$DOC: $!"; print $fh map { "$_\n" } @doc; close $fh;

# ---------- report ----------
printf "%d settlements, %d countries, %d land routes, %d straits, %d passes, %d mountains -> %s\n",
    scalar @ids, scalar @CORDER, scalar keys %LAND, scalar keys %STRAIT, scalar @PASSES, scalar @placed, "docs/map.png";
printf "%s at %d,%d: land of %d %s (%s)\n", $_->{id}, $_->{x}, $_->{y}, $_->{owner}, $S{ $_->{owner} }{name}, cname($S{ $_->{owner} }{country}) for @PASSES;
if (@touching) { warn sprintf "%d mountain(s) touch something: %s -- run `perl tools/map.pl mountains`\n", scalar @touching, join ' ', map { "$_->[0],$_->[1]" } @touching }
if ($MODE eq 'mountains') { my $moved = grep { my $q = $_; !grep { $_->[0] == $q->[0] && $_->[1] == $q->[1] } @PEAKS } @placed;
    printf "mountains: %d kept, %d moved, %d dropped%s\n", @placed - $moved, $moved, scalar @dropped, @dropped ? ' (no clear spot near ' . join(' ', map { "$_->[0],$_->[1]" } @dropped) . ')' : '' }

# =====================================================================================
# PNG (8-bit RGB/RGBA)
# =====================================================================================
sub load_png { my $f = shift; open my $h, '<:raw', $f or die "$f: $!"; local $/; my $d = <$h>;
    my ($w, $hh, $ct, $idat, $p) = (0, 0, 0, '', 8);
    while ($p < length $d) { my ($len, $type) = unpack 'Na4', substr($d, $p, 8); my $c = substr($d, $p + 8, $len);
        if ($type eq 'IHDR') { ($w, $hh, undef, $ct) = unpack 'NNCC', $c } elsif ($type eq 'IDAT') { $idat .= $c } $p += 12 + $len }
    my $bpp = $ct == 6 ? 4 : $ct == 2 ? 3 : die "$f: unsupported colour type $ct\n"; my $raw = uncompress($idat) // die "$f: inflate failed\n";
    my $stride = $w * $bpp; my @pv = (0) x $stride; my @img;
    for my $y (0 .. $hh - 1) { my $ft = ord substr($raw, $y * ($stride + 1), 1); my @c = unpack 'C*', substr($raw, $y * ($stride + 1) + 1, $stride);
        for my $i (0 .. $#c) { my $a = $i >= $bpp ? $c[$i - $bpp] : 0; my $b = $pv[$i]; my $cc = $i >= $bpp ? $pv[$i - $bpp] : 0;
            if    ($ft == 1) { $c[$i] = ($c[$i] + $a) & 255 }
            elsif ($ft == 2) { $c[$i] = ($c[$i] + $b) & 255 }
            elsif ($ft == 3) { $c[$i] = ($c[$i] + int(($a + $b) / 2)) & 255 }
            elsif ($ft == 4) { my $q = $a + $b - $cc; my ($pa, $pb, $pc) = (abs($q - $a), abs($q - $b), abs($q - $cc)); $c[$i] = ($c[$i] + ($pa <= $pb && $pa <= $pc ? $a : $pb <= $pc ? $b : $cc)) & 255 } }
        @pv = @c; push @img, [ map { [ @c[$_ * $bpp .. $_ * $bpp + 2], $bpp == 4 ? $c[$_ * $bpp + 3] : 255 ] } 0 .. $w - 1 ] }
    return ($w, $hh, \@img) }
sub save_png { my ($f, $w, $h, $img) = @_; my $raw = ''; $raw .= "\0" . pack 'C*', map { @$_ } @{ $img->[$_] } for 0 .. $h - 1;
    my $chunk = sub { pack('N', length $_[1]) . $_[0] . $_[1] . pack('N', crc32($_[0] . $_[1])) };
    open my $o, '>:raw', $f or die "$f: $!";
    print $o "\x89PNG\r\n\x1a\n", $chunk->('IHDR', pack 'NNCCCCC', $w, $h, 8, 6, 0, 0, 0), $chunk->('IDAT', compress($raw, 9)), $chunk->('IEND', ''); close $o }
