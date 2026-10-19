#!/usr/bin/perl
# Build this scenario's map-base.svg and the data tables of SCENARIO.md from real geography (data.pl).
#
#   perl scenarios/historical-1440/make-base.pl            write map-base.svg and the data tables of SCENARIO.md, then run
#                                                          perl tools/map.pl scenarios/historical-1440 mountains
#   perl scenarios/historical-1440/make-base.pl preview    only draw preview.png (lands, coasts, rivers)
#
# Running it again OVERWRITES map-base.svg and the data tables of SCENARIO.md: once you edit those by hand,
# edit them and run tools/map.pl only. Only core Perl is needed.
use strict; use warnings; use utf8; use open qw(:std :encoding(UTF-8));
use File::Basename qw(dirname); use Cwd qw(abs_path); use Math::Trig qw(tan); use List::Util qw(min max sum);
use Compress::Zlib qw(compress crc32);

my $HERE = dirname(abs_path(__FILE__));
my $MODE = shift // 'build'; die "usage: $0 [preview]\n" unless $MODE =~ /^(build|preview)$/;
our (@FORMABLES, @COUNTRIES, @SETTLEMENTS, %SEEDS, %ISLAND_OWNER, @PIECE_OWNER, @COAST, @RIVERS, @PASSES, @MOUNTAINS, @DIVIDERS, @ZONES, @STRAITS, @NO_ROUTE, %EXTRA_ROUTE);
require "$HERE/data.pl";

# ---------- projection: Lambert conformal conic, standard parallels 47 and 57 N, centred on 14 E ----------
my $DEG = atan2(1, 1) / 45; my $Q = atan2(1, 1);
my ($P1, $P2, $P0, $L0) = map { $_ * $DEG } (47, 57, 52.5, 14);
my $NC = log(cos($P1) / cos($P2)) / log(tan($Q + $P2 / 2) / tan($Q + $P1 / 2));
my $FC = cos($P1) * tan($Q + $P1 / 2)**$NC / $NC; my $R0 = $FC / tan($Q + $P0 / 2)**$NC;
sub km { my ($la, $lo) = @_; my $r = $FC / tan($Q + $la * $DEG / 2)**$NC; my $t = $NC * ($lo * $DEG - $L0); (6371 * $r * sin($t), 6371 * ($R0 - $r * cos($t))) }
my $KM_PER_UNIT = 1.2; my $MARGIN = 45;                                   # map units
my @sk = map { [ km($_->{lat}, $_->{lon}) ] } @SETTLEMENTS;
my $X0 = min(map { $_->[0] } @sk) - $MARGIN * $KM_PER_UNIT; my $Y1 = max(map { $_->[1] } @sk) + $MARGIN * $KM_PER_UNIT;
my $W = int((max(map { $_->[0] } @sk) + $MARGIN * $KM_PER_UNIT - $X0) / $KM_PER_UNIT + 0.5);
my $H = int(($Y1 - min(map { $_->[1] } @sk) + $MARGIN * $KM_PER_UNIT) / $KM_PER_UNIT + 0.5);
sub proj { my ($x, $y) = km(@_); (($x - $X0) / $KM_PER_UNIT, ($Y1 - $y) / $KM_PER_UNIT) }
sub pts { my $s = shift; my @n = split ' ', $s; die "odd number of coordinates\n" if @n % 2; map { [ @n[2 * $_, 2 * $_ + 1] ] } 0 .. $#n / 2 }
printf "map %d x %d units, 1 unit = %.1f km\n", $W, $H, $KM_PER_UNIT;

# ---------- settlements ----------
my (%SID, %CODE); my @S = (undef);                                        # ids from 1, in data order
my %ORD = map { $COUNTRIES[$_][0] => $_ } 0 .. $#COUNTRIES;
for my $s (@SETTLEMENTS) { die "settlement $s->{name}: unknown country $s->{country}\n" unless exists $ORD{ $s->{country} };
    die "duplicate settlement $s->{name}\n" if $SID{ $s->{name} }; push @S, $s; $s->{id} = $#S; $SID{ $s->{name} } = $s->{id};
    my ($x, $y) = proj($s->{lat}, $s->{lon}); @$s{qw(x y)} = (int($x), int($y)) }
for my $c (@COUNTRIES) { die "country $c->[0]: capital $c->[2] is not a settlement\n" unless $SID{ $c->[2] } }

# ---------- land mask: every coast ring, filled at pixel centres ----------
my @LAND = (0) x ($W * $H);                                               # 0 sea, else ring number + 1
my @RINGNAME;
for my $ri (0 .. $#COAST) { my ($name, $txt) = @{ $COAST[$ri] }; push @RINGNAME, $name;
    my @p = map { [ proj(@$_) ] } pts($txt); my @e = map { [ $p[$_ - 1], $p[$_] ] } 0 .. $#p;
    for my $y (0 .. $H - 1) { my $py = $y + 0.5;
        my @xs = sort { $a <=> $b } map { my ($a, $b) = @$_; ($a->[1] > $py) != ($b->[1] > $py) ? $a->[0] + ($py - $a->[1]) / ($b->[1] - $a->[1]) * ($b->[0] - $a->[0]) : () } @e;
        while (@xs >= 2) { my ($l, $r) = splice @xs, 0, 2; for my $x (max(0, int($l + 0.5)) .. min($W - 1, int($r + 0.5) - 1)) { $LAND[$y * $W + $x] = $ri + 1 } } } }

# connected pieces of land and of sea (4-neighbours)
sub pieces { my ($test) = @_; my @id = (0) x ($W * $H); my @size = (0); my $n = 0;
    for my $i (0 .. $W * $H - 1) { next if $id[$i] || !$test->($i); $n++; my @st = ($i); $id[$i] = $n; my $c = 0;
        while (defined(my $j = pop @st)) { $c++; my ($x, $y) = ($j % $W, int($j / $W));
            for my $k ($x > 0 ? $j - 1 : (), $x < $W - 1 ? $j + 1 : (), $y > 0 ? $j - $W : (), $y < $H - 1 ? $j + $W : ()) { next if $id[$k] || !$test->($k); $id[$k] = $n; push @st, $k } }
        push @size, $c } return (\@id, \@size) }
# small patches of sea enclosed by land (lakes left by the drawing) become land; a lagoon that closed up is reported
{ my ($sid, $ssize) = pieces(sub { !$LAND[$_[0]] }); my %edge;
  for my $x (0 .. $W - 1) { $edge{ $sid->[$x] } = 1; $edge{ $sid->[($H - 1) * $W + $x] } = 1 } for my $y (0 .. $H - 1) { $edge{ $sid->[$y * $W] } = 1; $edge{ $sid->[$y * $W + $W - 1] } = 1 }
  for my $i (0 .. $W * $H - 1) { my $p = $sid->[$i] or next; next if $edge{$p} || $ssize->[$p] >= 2000;
      my ($x, $y) = ($i % $W, int($i / $W)); my ($nb) = grep { $_ } map { $LAND[$_] } grep { $_ >= 0 && $_ < $W * $H } $i - 1, $i + 1, $i - $W, $i + $W; $LAND[$i] = $nb || 1 }
  my %rep; for my $i (0 .. $W * $H - 1) { my $p = $sid->[$i] or next; next if $edge{$p} || $ssize->[$p] >= 2000 || $rep{$p}++; next if $ssize->[$p] < 30;
      printf "  enclosed sea of %d units near %d,%d filled in\n", $ssize->[$p], $i % $W, int($i / $W) } }

# sea narrower than 3 units (the tips of estuaries) becomes land, so the coast can be straightened without pinching
{ my @sea = map { $LAND[$_] ? 0 : 1 } 0 .. $W * $H - 1; my @nb = sub { my $i = shift; my ($x, $y) = ($i % $W, int($i / $W));
      ($x > 0 ? $i - 1 : ()), ($x < $W - 1 ? $i + 1 : ()), ($y > 0 ? $i - $W : ()), ($y < $H - 1 ? $i + $W : ()) };
  my $nb = $nb[0]; my @core = map { $sea[$_] && !grep { !$sea[$_] } $nb->($_) } 0 .. $W * $H - 1; my $n = 0;
  for my $i (0 .. $W * $H - 1) { next unless $sea[$i] && !$core[$i] && !grep { $core[$_] } $nb->($i); my ($l) = grep { $_ } map { $LAND[$_] } $nb->($i); $LAND[$i] = $l || 1; $n++ }
  printf "  %d units of sea in channels under 3 units wide made land\n", $n }

# ---------- give the land to the settlements: nearest seed, measured over land ----------
for my $s (@S[1 .. $#S]) { next if $LAND[ $s->{y} * $W + $s->{x} ];      # a coastal town drawn just off the coast moves onto it
    my ($best) = sort { $a->[2] <=> $b->[2] } grep { $LAND[ $_->[1] * $W + $_->[0] ] } map { my $dy = $_; map { [ $s->{x} + $_, $s->{y} + $dy, $_ * $_ + $dy * $dy ] } -10 .. 10 } -10 .. 10;
    die "$s->{name} is more than 10 units out to sea\n" unless $best; printf "  %s moved %.0f units onto the coast\n", $s->{name}, sqrt $best->[2]; @$s{qw(x y)} = @$best[0, 1];
    # well inside the land: 3 units from the sea where it can be
    for (1 .. 3) { my ($x, $y) = @$s{qw(x y)}; my ($in) = grep { my ($u, $v) = @$_; !grep { !$LAND[ ($v + $_->[1]) * $W + $u + $_->[0] ] } [1, 0], [-1, 0], [0, 1], [0, -1] }
        map { [ $x + $_->[0], $y + $_->[1] ] } [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]; last unless $in; @$s{qw(x y)} = @$in } }
my ($PIECE, $PSIZE) = pieces(sub { $LAND[$_[0]] });
my @SEED;                                                                # [x, y, settlement id]
for my $s (@S[1 .. $#S]) { push @SEED, [ $s->{x}, $s->{y}, $s->{id} ];
    for (@{ $SEEDS{ $s->{name} } // [] }) { my ($x, $y) = proj(@$_); push @SEED, [ int $x, int $y, $s->{id} ] } }
for my $sd (@SEED) { die sprintf "a seed of %s (%d,%d) is off the map\n", $S[ $sd->[2] ]{name}, $sd->[0], $sd->[1] if $sd->[0] < 0 || $sd->[1] < 0 || $sd->[0] >= $W || $sd->[1] >= $H; my $i = $sd->[1] * $W + $sd->[0];
    unless ($LAND[$i]) { my $s = $S[ $sd->[2] ]; die sprintf "seed of %s at %d,%d (%s) is in the sea\n", $s->{name}, $sd->[0], $sd->[1], $sd->[0] == $s->{x} && $sd->[1] == $s->{y} ? 'the settlement' : 'an extra seed' } }
for my $s (@S[1 .. $#S]) { my $i = $s->{y} * $W + $s->{x}; die "$s->{name} lies on a piece of land with no room\n" unless $PIECE->[$i] }
my @OWN = (0) x ($W * $H); my @COST = (1e18) x ($W * $H); my @bucket;
for my $sd (@SEED) { my $i = $sd->[1] * $W + $sd->[0]; $COST[$i] = 0; $OWN[$i] = $sd->[2]; push @{ $bucket[0] }, $i }
for (my $c = 0; $c < @bucket; $c++) { my $b = $bucket[$c] or next;
    for my $i (@$b) { next if $COST[$i] < $c; my ($x, $y) = ($i % $W, int($i / $W));
        for ([1, 0, 10], [-1, 0, 10], [0, 1, 10], [0, -1, 10], [1, 1, 14], [1, -1, 14], [-1, 1, 14], [-1, -1, 14]) { my ($u, $v) = ($x + $_->[0], $y + $_->[1]);
            next if $u < 0 || $v < 0 || $u >= $W || $v >= $H; my $j = $v * $W + $u; next unless $LAND[$j];
            next if $_->[0] && $_->[1] && !($LAND[$y * $W + $u] && $LAND[$v * $W + $x]);      # no corner-cutting across water
            my $nc = $c + $_->[2]; next if $COST[$j] <= $nc; $COST[$j] = $nc; $OWN[$j] = $OWN[$i]; push @{ $bucket[$nc] }, $j } } undef $bucket[$c] }
# pieces nobody reached: islands, by their owner in ISLAND_OWNER, else dropped if tiny, else the nearest settlement
{ my %done;
  for (@PIECE_OWNER) { my ($la, $lo, $name) = @$_; my ($x, $y) = map { int } proj($la, $lo); my $i = $y * $W + $x;
      die "PIECE_OWNER $la $lo is not on land of the map\n" if $x < 0 || $y < 0 || $x >= $W || $y >= $H || !$LAND[$i]; $done{ $PIECE->[$i] } = $SID{$name} // die "PIECE_OWNER: no settlement $name\n" unless $OWN[$i] }
  for my $i (0 .. $W * $H - 1) { next if !$LAND[$i] || $OWN[$i]; my $p = $PIECE->[$i]; next if exists $done{$p}; $done{$p} = 0;
      my $ring = $RINGNAME[ $LAND[$i] - 1 ]; my $owner = $ISLAND_OWNER{$ring} ? $SID{ $ISLAND_OWNER{$ring} } : undef;
      if (!$owner && $PSIZE->[$p] < 60) { $done{$p} = 'drop' }
      elsif (!$owner) { my ($x, $y) = ($i % $W, int($i / $W)); ($owner) = map { $_->{id} } sort { ($a->{x} - $x)**2 + ($a->{y} - $y)**2 <=> ($b->{x} - $x)**2 + ($b->{y} - $y)**2 } @S[1 .. $#S];
          printf "  land near %d,%d (%s, %d units) has no settlement: given to %s\n", $x, $y, $ring, $PSIZE->[$p], $S[$owner]{name} }
      $done{$p} = $owner if $owner }
  for my $i (0 .. $W * $H - 1) { next if !$LAND[$i] || $OWN[$i]; my $o = $done{ $PIECE->[$i] }; if ($o eq 'drop') { $LAND[$i] = 0 } else { $OWN[$i] = $o } } }

# ---------- preview ----------
sub country_rgb { my $c = shift; my $h = 0; $h = ($h * 131 + ord) % 360 for split //, $c x 3; my ($s, $l) = (0.45, 0.78);
    my $f = sub { my $n = shift; my $k = ($n + $h / 30) % 12; $l - $s * min($l, 1 - $l) * max(-1, min($k - 3, 9 - $k, 1)) }; map { int(255 * $f->($_)) } 0, 8, 4 }
sub png { my ($file, $px) = @_; my $raw = '';
    for my $y (0 .. $H - 1) { $raw .= "\0" . pack('C*', map { @{ $px->[$y * $W + $_] } } 0 .. $W - 1) }
    my $chunk = sub { my ($t, $d) = @_; pack('N', length $d) . $t . $d . pack('N', crc32($t . $d)) };
    open my $f, '>:raw', $file or die "$file: $!"; print $f "\x89PNG\r\n\x1a\n", $chunk->('IHDR', pack('NNCCCCC', $W, $H, 8, 2, 0, 0, 0)), $chunk->('IDAT', compress($raw, 9)), $chunk->('IEND', ''); close $f }
sub preview { my $file = shift; my %rgb = map { $_->[0] => [ country_rgb($_->[0]) ] } @COUNTRIES; my @px;
    for my $i (0 .. $W * $H - 1) { my $o = $OWN[$i]; $px[$i] = $o ? $rgb{ $S[$o]{country} } : [153, 217, 234] }
    for my $i (0 .. $W * $H - 1) { my $o = $OWN[$i] or next; my ($x, $y) = ($i % $W, int($i / $W));
        for my $j ($x < $W - 1 ? $i + 1 : (), $y < $H - 1 ? $i + $W : ()) { my $p = $OWN[$j];
            if (!$p) { $px[$i] = [0, 0, 0] } elsif ($p != $o) { $px[$i] = $S[$p]{country} eq $S[$o]{country} ? [170, 170, 170] : [60, 60, 60] } }
        $px[$i] = [0, 0, 0] if ($x && !$OWN[$i - 1]) || ($y && !$OWN[$i - $W]) }
    for my $r (@RIVERS) { my @p = map { [ proj(@$_) ] } pts($r->[1]);
        for my $k (1 .. $#p) { my ($a, $b) = @p[$k - 1, $k]; my $n = int(2 * sqrt(($b->[0] - $a->[0])**2 + ($b->[1] - $a->[1])**2)) + 1;
            for my $t (0 .. $n) { my ($x, $y) = map { int($a->[$_] + ($b->[$_] - $a->[$_]) * $t / $n) } 0, 1; $px[$y * $W + $x] = [0, 110, 220] if $x >= 0 && $y >= 0 && $x < $W && $y < $H } } }
    for my $s (@S[1 .. $#S]) { my $r = $s->{city} ? 4 : 3; for my $dy (-$r .. $r) { for my $dx (-$r .. $r) { my ($x, $y) = ($s->{x} + $dx, $s->{y} + $dy);
        $px[$y * $W + $x] = [200, 20, 30] if $x >= 0 && $y >= 0 && $x < $W && $y < $H && ($s->{city} || $dx * $dx + $dy * $dy <= $r * $r) } } }
    png($file, \@px); print "wrote $file\n" }
if ($MODE eq 'preview') { preview("$HERE/preview.png"); exit }

# =====================================================================================
# lands as polygons: walk the edge of every land along the pixel grid, then straighten each stretch of edge
# between two meeting points once, so neighbouring lands keep exactly the same points
# =====================================================================================
sub lab { my ($x, $y) = @_; $x < 0 || $y < 0 || $x >= $W || $y >= $H ? -1 : $OWN[$y * $W + $x] }
my $VW = $W + 1;
my (%NODE, %POLY, %SIMPLE, %SHARED, @COASTSEG);   # corners where three things meet; land -> rings; chain -> simplified corners; "a-b" -> shared edge length
sub vxy { my $k = shift; ($k % $VW, int($k / $VW)) }
sub dp { my ($p, $eps) = @_; return @$p if @$p <= 2; my ($a, $b) = @$p[0, -1]; my ($bi, $bd) = (0, -1);
    my ($dx, $dy) = ($b->[0] - $a->[0], $b->[1] - $a->[1]); my $L = sqrt($dx * $dx + $dy * $dy);
    for my $i (1 .. $#$p - 1) { my $d = $L ? abs(($p->[$i][0] - $a->[0]) * $dy - ($p->[$i][1] - $a->[1]) * $dx) / $L : sqrt(($p->[$i][0] - $a->[0])**2 + ($p->[$i][1] - $a->[1])**2);
        ($bi, $bd) = ($i, $d) if $d > $bd }
    return ($a, $b) if $bd <= $eps; my @l = dp([ @$p[0 .. $bi] ], $eps); my @r = dp([ @$p[$bi .. $#$p] ], $eps); pop @l; (@l, @r) }
my $EPS = 1.0;
sub simple { my ($ch, $closed) = @_; my @c = @$ch; my @r = reverse @c;
    if ($closed) { my ($mi) = sort { $c[$a] <=> $c[$b] } 0 .. $#c; @c = (@c[$mi .. $#c], @c[0 .. $mi - 1]); @r = ($c[0], reverse @c[1 .. $#c]) }
    my $flip = $closed ? $c[1] > $r[1] : ($c[0] <=> $r[0] || $c[1] <=> $r[1]) > 0; my $key = join ',', $flip ? @r : @c;
    my $s = $SIMPLE{$key} //= do { my @p = map { [ vxy($_) ] } ($flip ? @r : @c);
        if ($closed) { my ($far) = sort { ($p[$b][0] - $p[0][0])**2 + ($p[$b][1] - $p[0][1])**2 <=> ($p[$a][0] - $p[0][0])**2 + ($p[$a][1] - $p[0][1])**2 } 0 .. $#p;
            my @l = dp([ @p[0 .. $far] ], $EPS); my @rr = dp([ @p[$far .. $#p], $p[0] ], $EPS); pop @l; pop @rr; my @o = (@l, @rr); @o >= 3 ? \@o : [] }
        else { [ dp(\@p, $EPS) ] } };
    # corners off the map edge move a hair, so no edge runs exactly through a pixel centre (where filling in is a coin toss)
    $s = [ map { [ $_->[0] == 0 || $_->[0] == $W ? $_->[0] : $_->[0] + 0.01, $_->[1] == 0 || $_->[1] == $H ? $_->[1] : $_->[1] + 0.07 ] } @$s ];
    return $flip ? [ reverse @$s ] : [ @$s ] }
sub trace { %NODE = (); %POLY = (); %SIMPLE = (); %SHARED = (); @COASTSEG = ();
for my $j (0 .. $H) { for my $i (0 .. $W) { my @q = (lab($i - 1, $j - 1), lab($i, $j - 1), lab($i, $j), lab($i - 1, $j));
    next unless grep { $_ > 0 } @q; my %d = map { $_ => 1 } @q;
    $NODE{ $j * $VW + $i } = 1 if keys %d >= 3 || (keys %d == 2 && $q[0] == $q[2] && $q[1] == $q[3]) } }
my (%OUT, %RINGS);                        # land -> start corner -> [end corner, dx, dy, other side]
for my $y (0 .. $H - 1) { for my $x (0 .. $W - 1) { my $l = $OWN[$y * $W + $x] or next;
    for ([0, -1, $x, $y, $x + 1, $y, 1, 0], [1, 0, $x + 1, $y, $x + 1, $y + 1, 0, 1], [0, 1, $x + 1, $y + 1, $x, $y + 1, -1, 0], [-1, 0, $x, $y + 1, $x, $y, 0, -1]) {
        my ($nx, $ny, $ax, $ay, $bx, $by, $dx, $dy) = @$_; my $o = lab($x + $nx, $y + $ny); next if $o == $l;
        push @{ $OUT{$l}{ $ay * $VW + $ax } }, [ $by * $VW + $bx, $dx, $dy, $o ] } } }
for my $l (keys %OUT) { my $out = $OUT{$l};       # the land is on the right of every edge; at a crosswise corner turn right
    for my $start (sort { $a <=> $b } keys %$out) { while (@{ $out->{$start} }) { my $e = shift @{ $out->{$start} }; my @ring = ([$start, $e->[3]]);
        my ($v, $dx, $dy) = @$e[0 .. 2];
        while ($v != $start || @{ $out->{$v} // [] } && 0) { my $c = $out->{$v} or die "land $l: broken edge at corner $v\n"; last unless @$c;
            my $k = 0; if (@$c > 1) { my %pref = ("@{[-$dy]} $dx" => 0, "$dx $dy" => 1, "$dy @{[-$dx]}" => 2); ($k) = sort { $pref{"$c->[$a][1] $c->[$a][2]"} <=> $pref{"$c->[$b][1] $c->[$b][2]"} } 0 .. $#$c }
            my $n = splice @$c, $k, 1; push @ring, [$v, $n->[3]]; ($v, $dx, $dy) = @$n[0 .. 2] }
        push @{ $RINGS{$l} }, \@ring } } }
undef %OUT;
for my $l (sort { $a <=> $b } keys %RINGS) { for my $ring (@{ $RINGS{$l} }) {
    my @n = grep { $NODE{ $ring->[$_][0] } } 0 .. $#$ring; my @out;
    my @chains;                           # [corners..., other side]
    if (!@n) { push @chains, [ [ map { $_->[0] } @$ring ], $ring->[0][1], 1 ] }
    else { for my $k (0 .. $#n) { my ($a, $b) = ($n[$k], $n[ ($k + 1) % @n ]); my @idx = $b > $a ? ($a .. $b) : ($a .. $#$ring, 0 .. $b);
        push @chains, [ [ map { $ring->[$_][0] } @idx ], $ring->[$a][1], 0 ] } }
    for my $c (@chains) { my ($corners, $other, $closed) = @$c; my $s = simple($corners, $closed);
        if ($other > 0 && $other != $l) { $SHARED{ join '-', sort { $a <=> $b } $l, $other } += @$corners - 1 + $closed }
        push @COASTSEG, map { [ $s->[$_ - 1], $s->[$_] ] } 1 .. $#$s if $other == 0 && @$s;
        push @COASTSEG, [ $s->[-1], $s->[0] ] if $other == 0 && $closed && @$s;
        my @s = @$s; shift @s if @out && @s && $out[-1][0] == $s[0][0] && $out[-1][1] == $s[0][1]; push @out, @s }
    pop @out if @out > 1 && $out[0][0] == $out[-1][0] && $out[0][1] == $out[-1][1];
    push @{ $POLY{$l} }, \@out if @out >= 3 } }
undef %RINGS; %SIMPLE = () }
sub gaps {      # fill the polygons in as tools/map.pl does: patches of sea under 2000 units shut in between lands
    my @reg = (0) x ($W * $H);
    for my $l (keys %POLY) { my @e; for my $r (@{ $POLY{$l} }) { push @e, map { [ $r->[$_], $r->[ $_ - 1 ] ] } 0 .. $#$r }
        my ($y0, $y1) = (min(map { $_->[0][1] } @e), max(map { $_->[0][1] } @e));
        for my $y (max(0, int $y0) .. min($H - 1, int $y1)) { my $py = $y + 0.5;
            my @xs = sort { $a <=> $b } map { my ($a, $b) = @$_; ($a->[1] > $py) != ($b->[1] > $py) ? $a->[0] + ($py - $a->[1]) / ($b->[1] - $a->[1]) * ($b->[0] - $a->[0]) : () } @e;
            while (@xs >= 2) { my ($a, $b) = splice @xs, 0, 2; for my $x (max(0, int($a + 0.5)) .. min($W - 1, int($b + 0.5) - 1)) { $reg[$y * $W + $x] = $l } } } }
    my @seen = (0) x ($W * $H); my @fill;
    for my $i (0 .. $W * $H - 1) { next if $reg[$i] || $seen[$i]; my @st = ($i); $seen[$i] = 1; my @patch;
        while (defined(my $j = pop @st)) { push @patch, $j; my ($x, $y) = ($j % $W, int($j / $W));
            for my $k ($x > 0 ? $j - 1 : (), $x < $W - 1 ? $j + 1 : (), $y > 0 ? $j - $W : (), $y < $H - 1 ? $j + $W : ()) { next if $reg[$k] || $seen[$k]++; push @st, $k } }
        push @fill, @patch if @patch < 2000 }
    return (\@reg, \@fill) }
for my $round (1 .. 5) { trace(); my ($reg, $fill) = gaps(); last unless @$fill;
    die "could not close the gaps between lands\n" if $round == 5;
    printf "  %d units of sea shut in between lands: filled in (%s)\n", scalar @$fill, join " ", map { ($_ % $W) . "," . int($_ / $W) } @$fill[0 .. min(5, $#$fill)]; my %f = map { $_ => 1 } @$fill;
    while (%f) { my $n = keys %f;
        for my $i (keys %f) { my ($nb) = grep { $_ } map { $f{$_} ? 0 : ($reg->[$_] || $OWN[$_]) } grep { $_ >= 0 && $_ < $W * $H } $i - 1, $i + 1, $i - $W, $i + $W;
            next unless $nb; $OWN[$i] = $nb; $reg->[$i] = $nb; delete $f{$i} }
        die "a shut-in patch has no land next to it\n" if keys %f == $n } }
sub inside { my ($x, $y, $rings) = @_; my $in = 0;
    for my $r (@$rings) { for my $i (0 .. $#$r) { my ($a, $b) = ($r->[$i], $r->[ $i - 1 ]);
        $in = !$in if ($a->[1] > $y) != ($b->[1] > $y) && $x < $a->[0] + ($y - $a->[1]) / ($b->[1] - $a->[1]) * ($b->[0] - $a->[0]) } } $in }
sub edge_dist { my ($x, $y, $rings) = @_; my $m = 1e9;
    for my $r (@$rings) { for my $i (0 .. $#$r) { my ($a, $b) = ($r->[$i], $r->[ $i - 1 ]); my ($dx, $dy) = ($b->[0] - $a->[0], $b->[1] - $a->[1]); my $L2 = $dx * $dx + $dy * $dy;
        my $t = $L2 ? (($x - $a->[0]) * $dx + ($y - $a->[1]) * $dy) / $L2 : 0; $t = $t < 0 ? 0 : $t > 1 ? 1 : $t; my $d = sqrt(($x - $a->[0] - $t * $dx)**2 + ($y - $a->[1] - $t * $dy)**2); $m = $d if $d < $m } } $m }
for my $s (@S[1 .. $#S]) { my $p = $POLY{ $s->{id} } or die "$s->{name} has no land\n";      # marker well inside its land
    next if inside($s->{x}, $s->{y}, $p) && edge_dist($s->{x}, $s->{y}, $p) >= 3;
    my ($best) = sort { $b->[2] <=> $a->[2] || $a->[3] <=> $b->[3] } map { my ($u, $v) = @$_; inside($u, $v, $p) ? [ $u, $v, min(4, edge_dist($u, $v, $p)), ($u - $s->{x})**2 + ($v - $s->{y})**2 ] : () }
        map { my $dy = $_; map { [ $s->{x} + $_, $s->{y} + $dy ] } -8 .. 8 } -8 .. 8;
    die "$s->{name}: no room for its marker in its land\n" unless $best; @$s{qw(x y)} = @$best[0, 1] }

# ---------- rivers, sea zone dividers ----------
sub seg_dist { my ($px, $py, $a, $b) = @_; my ($dx, $dy) = ($b->[0] - $a->[0], $b->[1] - $a->[1]); my $L2 = $dx * $dx + $dy * $dy;
    my $t = $L2 ? (($px - $a->[0]) * $dx + ($py - $a->[1]) * $dy) / $L2 : 0; $t = $t < 0 ? 0 : $t > 1 ? 1 : $t; ([ $a->[0] + $t * $dx, $a->[1] + $t * $dy ], sqrt(($px - $a->[0] - $t * $dx)**2 + ($py - $a->[1] - $t * $dy)**2)) }
sub clip { my @p = @_; my @runs; my @cur;      # keep the part of a line inside the map
    my $in = sub { $_[0][0] >= 0 && $_[0][1] >= 0 && $_[0][0] <= $W && $_[0][1] <= $H };
    my $cut = sub { my ($a, $b) = @_; my $t = 1; for ([0, 0], [0, $W], [1, 0], [1, $H]) { my ($k, $v) = @$_; my $d = $b->[$k] - $a->[$k]; next unless $d;
        my $u = ($v - $a->[$k]) / $d; next unless $u >= 0 && $u <= 1; my @q = map { $a->[$_] + ($b->[$_] - $a->[$_]) * $u } 0, 1; $t = $u if $u < $t && $in->(\@q) } [ map { $a->[$_] + ($b->[$_] - $a->[$_]) * $t } 0, 1 ] };
    for my $i (0 .. $#p) { if ($in->($p[$i])) { push @cur, $i && !$in->($p[$i - 1]) ? ($cut->($p[$i], $p[$i - 1]), $p[$i]) : $p[$i] }
        else { if (@cur) { push @cur, $cut->($p[$i - 1], $p[$i]); push @runs, [@cur]; @cur = () } } }
    push @runs, [@cur] if @cur; grep { @$_ >= 2 } @runs }
my @RIVERLINES;
for my $r (@RIVERS) { my @p = map { [ proj(@$_) ] } pts($r->[1]);
    for my $s (@S[1 .. $#S]) { for my $q (@p) {          # a town sits on one bank: the river passes 7 units off its centre
        my ($dx, $dy) = ($q->[0] - $s->{x}, $q->[1] - $s->{y}); my $d = sqrt($dx * $dx + $dy * $dy); next if $d >= 7;
        ($dx, $dy, $d) = (0.6, 0.8, 1) if $d < 0.5; @$q = ($s->{x} + $dx / $d * 7, $s->{y} + $dy / $d * 7) } }
    for my $run (clip(@p)) { my @q = dp($run, 1.5);
        my ($best, $bd) = (undef, 1e9); for (@COASTSEG) { my ($c, $d) = seg_dist(@{ $q[-1] }, @$_); ($best, $bd) = ($c, $d) if $d < $bd }
        $q[-1] = $best if $bd < 25;                                  # the mouth lies on the coast
        push @RIVERLINES, [ $r->[0], \@q ] } }
sub ray_hit { my ($o, $dir) = @_; my $best = 1e9;      # nearest coast crossing from o along dir
    for my $s (@COASTSEG) { my ($a, $b) = @$s; my ($ex, $ey) = ($b->[0] - $a->[0], $b->[1] - $a->[1]); my $den = $dir->[0] * $ey - $dir->[1] * $ex; next if abs($den) < 1e-12;
        my $t = (($a->[0] - $o->[0]) * $ey - ($a->[1] - $o->[1]) * $ex) / $den; my $u = (($a->[0] - $o->[0]) * $dir->[1] - ($a->[1] - $o->[1]) * $dir->[0]) / $den;
        $best = $t if $t > 0 && $u >= 0 && $u <= 1 && $t < $best } $best }
my @DIVLINES;
for my $d (@DIVIDERS) { my ($a, $b) = map { [ proj(@$_) ] } pts($d); my $m = [ ($a->[0] + $b->[0]) / 2, ($a->[1] + $b->[1]) / 2 ];
    my @end = map { my $e = $_; my ($dx, $dy) = ($e->[0] - $m->[0], $e->[1] - $m->[1]); my $L = sqrt($dx * $dx + $dy * $dy); my $t = ray_hit($m, [ $dx / $L, $dy / $L ]);
        warn sprintf "sea zone divider near %.0f,%.0f reaches no coast\n", @$m if $t > 400; [ map { 0 + sprintf '%.2f', $_ } $m->[0] + $dx / $L * $t, $m->[1] + $dy / $L * $t ] } ($a, $b);
    push @DIVLINES, \@end }

# ---------- routes: lands that share an edge, passes, straits ----------
my %NOR = map { my ($u, $v) = map { $SID{$_} // die "NO_ROUTE: no settlement $_\n" } @$_; (join('-', sort { $a <=> $b } $u, $v) => 1) } @NO_ROUTE;
my %ROUTE = map { $_ => 1 } grep { $SHARED{$_} >= 12 && !$NOR{$_} } keys %SHARED;
my @PASSOUT;
for my $p (@PASSES) { my ($id, $la, $lo, $routes) = @$p; my ($x, $y) = map { int } proj($la, $lo); my @r;
    for (@$routes) { my ($u, $v) = map { $SID{$_} // die "pass $id: no settlement $_\n" } @$_; my $k = join '-', sort { $a <=> $b } $u, $v;
        if ($ROUTE{$k}) { push @r, $k } else { warn "pass $id: $_->[0] and $_->[1] do not share a border; route left out\n" } }
    die "pass $id is not on land\n" unless $OWN[$y * $W + $x]; push @PASSOUT, [ $id, $x, $y, \@r ] if @r }
my %STR = map { my ($u, $v) = map { $SID{$_} // die "STRAITS: no settlement $_\n" } @$_; (join('-', sort { $a <=> $b } $u, $v) => 1) } @STRAITS;
my (%NB, %ST); for (keys %ROUTE) { my ($a, $b) = split /-/; push @{ $NB{$a} }, $b; push @{ $NB{$b} }, $a } for (keys %STR) { my ($a, $b) = split /-/; push @{ $ST{$a} }, $b; push @{ $ST{$b} }, $a }
for my $s (@S[1 .. $#S]) { warn "$s->{name} has no route to anywhere\n" unless $NB{ $s->{id} } || $ST{ $s->{id} } }

# =====================================================================================
# map-base.svg
# =====================================================================================
sub dl { 'M' . join(' L', map { join ' ', map { 0 + sprintf '%.2f', $_ } @$_ } @{ $_[0] }) }
open my $fh, '>', "$HERE/map-base.svg" or die $!;
print $fh qq{<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 $W $H" width="$W" height="$H">\n},
    qq{<!-- Map geometry for map.svg (see SCENARIO.md). Made by make-base.pl from real latitudes and longitudes (data.pl);\n},
    qq{     edit it by hand from here on (Inkscape, with snapping) and run tools/map.pl. One shape per settlement's land (id land-N),\n},
    qq{     the rivers and the sea zone dividers. Neighbouring lands share exactly the same points; straight segments only. -->\n},
    qq{<rect width="$W" height="$H" fill="#99d9ea"/>\n<g id="lands" fill="#ffffff" stroke="#7f7f7f" stroke-width="1">\n};
printf $fh qq{  <path id="land-%d" d="%s"/>\n}, $_, join(' ', map { dl($_) . ' Z' } @{ $POLY{$_} }) for sort { $a <=> $b } keys %POLY;
print $fh qq{</g>\n<g id="rivers" fill="none" stroke="#00a2e8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">\n};
printf $fh qq{  <path d="%s"/><!-- %s -->\n}, dl($_->[1]), $_->[0] for @RIVERLINES;
print $fh qq{</g>\n<g id="sea-zones" fill="none" stroke="#3d7f9c" stroke-width="1.5" stroke-dasharray="6 4">\n};
printf $fh qq{  <path d="%s"/>\n}, dl($_) for @DIVLINES;
print $fh "</g>\n</svg>\n"; close $fh;
printf "map-base.svg: %d lands, %d rivers, %d sea zone dividers; %d land routes, %d straits, %d passes\n", scalar keys %POLY, scalar @RIVERLINES, scalar @DIVLINES, scalar keys %ROUTE, scalar keys %STR, scalar @PASSOUT;

# =====================================================================================
# SCENARIO.md: the data tables are (re)written; everything else in an existing file is kept
# =====================================================================================
my $DOCF = "$HERE/SCENARIO.md";
my @doc = -e $DOCF ? do { open my $f, '<', $DOCF or die $!; my @l = <$f>; chomp @l; @l } : split /\n/, template();
sub ranges { my @n = sort { $a <=> $b } @_; my @r;
    while (@n) { my $a = shift @n; my $b = $a; $b = shift @n while @n && $n[0] == $b + 1; push @r, $b == $a ? $a : $b == $a + 1 ? "$a, $b" : "$a–$b" } join ', ', @r }
sub put_table { my ($title, @t) = @_; my ($s) = grep { $doc[$_] =~ /^## \Q$title\E\s*$/ } 0 .. $#doc; die "SCENARIO.md: no '## $title'\n" unless defined $s;
    my $i = $s + 1; $i++ while $i <= $#doc && $doc[$i] !~ /^\|/ && $doc[$i] !~ /^#{1,2} /; die "SCENARIO.md: no table under '## $title'\n" unless $doc[$i] =~ /^\|/;
    my $j = $i; $j++ while $j <= $#doc && $doc[$j] =~ /^\|/; splice @doc, $i, $j - $i, @t }
my %BYC; push @{ $BYC{ $_->{country} } }, $_->{id} for @S[1 .. $#S];
put_table('Countries', '| Code | Country | Capital | Settlements | Pop | Army | Ships | HRE |', '|---|---|---|---|---|---|---|---|',
    map { sprintf '| %s | %s | %d %s |  |  |  |  |  |', $_->[0], $_->[1], $SID{ $_->[2] }, $_->[2] } @COUNTRIES);
put_table('Settlements', '| ID | Name | Country | Type | Port | HRE | X | Y | Borders | Straits |', '|---|---|---|---|---|---|---|---|---|---|',
    map { my $s = $_; sprintf '| %d | %s | %s | %s | %s | %s | %d | %d | %s | %s |', $s->{id}, $s->{name}, $s->{country}, $s->{city} ? 'city' : 'town', $s->{port} ? 'port' : '',
        $s->{hre} ? 'HRE' : '', $s->{x}, $s->{y}, join(', ', sort { $a <=> $b } @{ $NB{ $s->{id} } // [] }), join(', ', sort { $a <=> $b } @{ $ST{ $s->{id} } // [] }) } @S[1 .. $#S]);
put_table('Mountain passes', '| Pass | X | Y | Routes | In the land of | Owner at start |', '|---|---|---|---|---|---|',
    map { sprintf '| %s | %d | %d | %s |  |  |', $_->[0], $_->[1], $_->[2], join ', ', @{ $_->[3] } } @PASSOUT);
put_table('Sea zones', '| Zone | X | Y | Ports | Straits | Next to |', '|---|---|---|---|---|---|', map { my ($x, $y) = map { int } proj($_->[1], $_->[2]); "| $_->[0] | $x | $y |  |  |  |" } @ZONES);
put_table('Special coring', '| Formable | What it was | Settlements | Count |', '|---|---|---|---|', map { my ($n, $what, $parts) = @$_;
    my @ids = sort { $a <=> $b } map { my $p = $_; $BYC{$p} ? @{ $BYC{$p} } : ($SID{$p} // die "formable $n: no country or settlement $p\n") } @$parts; my %u = map { $_ => 1 } @ids;
    sprintf '| **%s** | %s | %s | %d |', $n, $what, ranges(keys %u), scalar keys %u } @FORMABLES);
{ my ($s) = grep { $doc[$_] =~ /^## Mountains\s*$/ } 0 .. $#doc; my ($f, $t) = grep { $doc[$_] =~ /^```/ } $s .. $#doc;
  my @p = map { join ',', map { int } proj(@$_) } map { pts($_) } @MOUNTAINS; my @l; push @l, join '  ', splice @p, 0, 8 while @p; splice @doc, $f + 1, $t - $f - 1, @l }
open my $df, '>', $DOCF or die $!; print $df map { "$_\n" } @doc; close $df;
print "SCENARIO.md: data tables written\n";

# The first SCENARIO.md, used only when none exists. Its hand-written sections (the situation in 1440, the Empire,
# the design notes) have since been rewritten in SCENARIO.md itself, which make-base.pl keeps.
sub template { my $cities = scalar grep { $_->{city} } @S[1 .. $#S]; return <<"MD" }
# SCENARIO: HISTORICAL 1440

*Everything here is specific to this map; the general rules are in [RULES.md](../../docs/RULES.md).*

A more accurate take on the Mitteleuropa map ([docs/SCENARIO.md](../../docs/SCENARIO.md)): the same corner of Europe
in the year 1440, with every town where it really is, the realms that really existed, and towns made cities by
how big they really were.

This file is the **only** place the map's facts are written down. The map's shapes — one per settlement's land,
plus the rivers and the sea zone dividers — are in [map-base.svg](map-base.svg). From the two, a script builds
[map.svg](map.svg), the map the game shows, and [scenario.json](scenario.json), this scenario as data for the
game. After changing either, run:

```
perl tools/map.pl scenarios/historical-1440              # check everything, rebuild map.svg and scenario.json, refresh this file
perl tools/map.pl scenarios/historical-1440 mountains    # the same, but first move any mountain that touches something
```

map-base.svg and the data tables here were first made by
[make-base.pl](make-base.pl) from real latitudes and longitudes ([data.pl](data.pl)); running it again
**overwrites** map-base.svg and the tables, so once you edit them by hand, use tools/map.pl only.

Columns and blocks marked *generated* are rewritten by the script — edit the rest.

**x = 1** (see the scenario scaling note in RULES.md)

**Army speed:** 420 map units per year — a route takes its length on the map ÷ this (RULES.md §8). One map unit
is about 1.2 km, so an army covers about 500 km a year, as on the Mitteleuropa map.

<!-- generated:summary -->
<!-- /generated -->

![Map](map.svg)

## Countries

*Code, Country and Capital are data (Capital is a settlement ID; the script adds the name); the other columns are generated. A country that owns a city must have one as its capital (RULES.md §2).*

| Code | Country | Capital | Settlements | Pop | Army | Ships | HRE |
|---|---|---|---|---|---|---|---|

## Settlements

- **Type** — `town` (red circle, 10,000 pop) or `city` (red square, 20,000 pop). The $cities cities are the largest
  towns of the map around 1440.
- **Port** — the settlement sits on the coast. 46 Bremen is a port **by ruling**: it lies up the Weser.
- **HRE** — inside the Holy Roman Empire.
- **X, Y** — marker centre, in map units (the coordinates of map.svg). The settlement's land is the shape
  `land-ID` in map-base.svg; country borders are drawn wherever two lands belong to different countries.
- **Borders** — settlements an army can march to in one step (every route is listed under both ends). Routes
  through a mountain pass are listed here too; the pass itself is in *Mountain passes*.
- **Straits** — crossings by sea (dashed lines, RULES.md §8).

| ID | Name | Country | Type | Port | HRE | X | Y | Borders | Straits |
|---|---|---|---|---|---|---|---|---|---|

## Mountain passes

Yellow triangles on the map. Every route listed runs settlement → pass → settlement. A pass belongs to whoever
owns the settlement whose land it lies in (RULES.md §8). *Pass, X, Y and Routes are data; the other columns are
generated from where the pass lies.*

| Pass | X | Y | Routes | In the land of | Owner at start |
|---|---|---|---|---|---|

## Route bends

A route is drawn straight, and the script bends it by itself only where the straight line would leave its
countries' land. List a route here to bend it through points of your own. *All columns are data.* Points are x,y
in map units, in order from the lower-numbered settlement; the route's length (and so its marching time) follows
the bend.

| Route | Through | Why |
|---|---|---|

## Mountains

Decoration only — mountains have no rules effect outside the passes. Apex positions (x,y in map units);
`perl tools/map.pl scenarios/historical-1440 mountains` moves any that touch something else.

```
```

## Overview

<!-- generated:overview -->
<!-- /generated -->

## Special coring
*(no Courthouse and no 20-year wait)*

You may proclaim a region when **both** are true:

1. Your **capital** lies within the region.
2. You control **100%** of its settlements.

Every settlement in the region becomes core immediately. If you later lose one and retake it, it is core again
on capture.

| Formable | What it was | Settlements | Count |
|---|---|---|---|

## Sea zones

Seven zones, split by the dashed lines in the sea. A fleet operates in one zone at a time (RULES.md §7). A port
belongs to the zone its coast faces; crossing a strait needs 10 ships in the zone the strait lies in (RULES.md
§8). *Zone, X and Y are data — X, Y is where the name is drawn, and the zone it names is the one around that
point; the other columns are generated from the map.*

| Zone | X | Y | Ports | Straits | Next to |
|---|---|---|---|---|---|

## The Holy Roman Empire

The Empire is every settlement marked **HRE** above (listed in the *Overview*).

Demand to become leader of the Empire under your hegemony. You must control **at least 20 settlements inside
the HRE**, and may propose **only once, ever**.

Each German state — every country that holds an HRE settlement — rolls on its own, like a protectorate demand
(RULES.md §10):
```
chance each German state joins = size × 10 % + opinion ÷ 10 %
at most 75%
0% if your pop is not larger than theirs, or if their opinion of you is below −50
```

Every German state that joins becomes your **protectorate** (RULES.md §10) and pays you **10%** of its yearly
money.

**The states that refuse form the League.** All of them make a **defensive alliance** with each other — declare
war on one member and the rest join against you. Refusing does not change their opinion of you (RULES.md §10).

## Victory

> **Control or vassalize 85 settlements.** Protectorates count as half — unless you demand one become a vassal
> and it agrees.

**End date: 1650.** The game ends when a player reaches 85, or at the start of **1650** — 210 years, about 2 hours
8 minutes of play. At the end date the player with the most settlements wins, counted the same way: controlled
and vassalized settlements count 1, protectorates ½. A tie goes to the larger total population (own settlements
and subjects).

---

## Design notes

*Hand-written. Unlike everything above it is not checked by the script, so re-read it after changing countries
or borders.*
MD
