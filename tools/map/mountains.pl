#!/usr/bin/perl
# Re-place the mountain peaks so none of them touches anything else (borders, rivers, coast, frame,
# settlements, connection lines, passes, other mountains). Peaks stay in their own province, as close
# to their old spot as possible.
#
#   perl tools/map/mountains.pl docs/plan/map-clean.png
#
# Rewrites map-clean.png in place and records the peak positions in tools/map/mountains.txt.
# If mountains.txt exists, peaks are read from it; otherwise they are detected on the map.
use strict; use warnings; use FindBin; require "$FindBin::Bin/common.pl";
our ($DIR, $MTN_W, $MTN_H, @MTN_SNOW, @MTN_SNOWS, @RIVER, @BORDER);

my ($file, $GAP, $REACH) = @ARGV; die "usage: $0 map-clean.png [gap_px] [search_px]\n" unless $file;
$GAP //= 5; $REACH //= 40;
my ($W, $H, $I) = load_png($file);
my @ORIG = map { [ map { [@$_] } @$_ ] } @$I;
sub inb { $_[0] >= 0 && $_[1] >= 0 && $_[0] < $W && $_[1] < $H }
sub col { my ($img, $x, $y) = @_; join ',', @{ $img->[$y][$x] }[0 .. 2] }
my @N4 = ([1, 0], [-1, 0], [0, 1], [0, -1]); my @N8 = (@N4, [1, 1], [-1, -1], [1, -1], [-1, 1]);

my ($C, $isCity, $mk) = find_settlements(\@ORIG, $W, $H);
my ($land, $strait) = read_connections();
my $pass = read_passes();

# ---------- current peaks ----------
my @peaks;
if (-e "$DIR/mountains.txt") {
    open my $f, '<', "$DIR/mountains.txt" or die; while (<$f>) { next if /^#/ || !/\S/; my ($x, $y) = split; push @peaks, [$x, $y] }
} else {
    # calibrate: where does the snow start relative to the apex?
    my @t = map { [ map { [255, 255, 255, 255] } 1 .. 60 ] } 1 .. 60; draw_mountain(\@t, 60, 60, 30, 10);
    my ($ty, $sx, $sn) = (99, 0, 0);
    for my $y (0 .. 59) { for my $x (0 .. 59) { my $c = col(\@t, $x, $y); next unless $c eq join(',', @MTN_SNOW) || $c eq join(',', @MTN_SNOWS); $ty = $y if $y < $ty } }
    for my $yy ($ty, $ty + 1) { for my $x (0 .. 59) { my $c = col(\@t, $x, $yy); if ($c eq join(',', @MTN_SNOW) || $c eq join(',', @MTN_SNOWS)) { $sx += $x; $sn++ } } }
    my ($dy, $dx) = ($ty - 10, $sx / $sn - 30);
    my %snow = map { (join(',', @$_) => 1) } (\@MTN_SNOW, \@MTN_SNOWS); my %seen; my @caps;
    for my $y (0 .. $H - 1) { for my $x (0 .. $W - 1) { next if $seen{"$x,$y"} || !$snow{ col(\@ORIG, $x, $y) };
        my @q = ([$x, $y]); $seen{"$x,$y"} = 1; my @c;
        while (my $p = pop @q) { push @c, $p; my ($a, $b) = @$p; for (@N8) { my ($u, $v) = ($a + $_->[0], $b + $_->[1]);
            next if !inb($u, $v) || $seen{"$u,$v"} || !$snow{ col(\@ORIG, $u, $v) }; $seen{"$u,$v"} = 1; push @q, [$u, $v] } }
        push @caps, \@c } }
    # the lit/shaded split line cuts a cap in two: merge pieces that nearly touch
    my $merged = 1;
    while ($merged) { $merged = 0;
        M: for my $i (0 .. $#caps) { for my $j ($i + 1 .. $#caps) {
            for my $p (@{ $caps[$i] }) { for my $q (@{ $caps[$j] }) { next if abs($p->[0] - $q->[0]) > 3 || abs($p->[1] - $q->[1]) > 3;
                push @{ $caps[$i] }, @{ $caps[$j] }; splice @caps, $j, 1; $merged = 1; last M } } } } }
    for my $c (@caps) { next if @$c < 4; my $top = 1e9; $top = $_->[1] < $top ? $_->[1] : $top for @$c;
        my @row = grep { $_->[1] <= $top + 1 } @$c; my $mx = 0; $mx += $_->[0] for @row; $mx /= @row;
        push @peaks, [ int($mx - $dx + 0.5), $top - $dy ] }
}
printf "%d peaks\n", scalar @peaks;

# ---------- lift the peaks off the map ----------
my %hole;
for my $p (@peaks) { my ($ax, $ay) = ($p->[0] + 0.5, $p->[1] + 0.5);
    for my $y (int($ay) - 5 .. int($ay + $MTN_H) + 4) { for my $x (int($ax - $MTN_W / 2) - 4 .. int($ax + $MTN_W / 2) + 4) {
        next unless inb($x, $y) && mountain_inside($ax, $ay, $x + 0.5, $y + 0.5, 2.2); $hole{"$x,$y"} = 1 } } }
my %markerHit; for my $k (keys %hole) { $markerHit{ $mk->{$k} } = 1 if defined $mk->{$k} }
$I->[ (split /,/)[1] ][ (split /,/)[0] ] = [255, 255, 255, 255] for keys %hole;

# lines that ran underneath: reconnect their loose ends straight across each hole
sub cls { my ($x, $y) = @_; my $p = $ORIG[$y][$x];
    return 'border' if $p->[0] == $p->[1] && $p->[1] == $p->[2] && $p->[0] >= 100 && $p->[0] <= 215;
    return 'river'  if $p->[2] > 150 && $p->[0] < 120 && !($p->[0] == 153 && $p->[1] == 217);
    return 'coast'  if $p->[0] < 70 && $p->[1] < 70 && $p->[2] < 70;
    return '' }
my %STYLE = (border => [[@BORDER], 1.5], river => [[@RIVER], 1.25], coast => [[0, 0, 0], 1.0]);
my @bridges; my %done;
for my $start (sort keys %hole) { next if $done{$start};
    my @q = ($start); $done{$start} = 1; my @comp;
    while (my $k = pop @q) { push @comp, $k; my ($x, $y) = split /,/, $k;
        for (@N8) { my $kk = ($x + $_->[0]) . "," . ($y + $_->[1]); next if !$hole{$kk} || $done{$kk}; $done{$kk} = 1; push @q, $kk } }
    my %ring;
    for my $k (@comp) { my ($x, $y) = split /,/, $k;
        for (@N8) { my ($u, $v) = ($x + $_->[0], $y + $_->[1]); next if !inb($u, $v) || $hole{"$u,$v"} || defined $mk->{"$u,$v"}; my $c = cls($u, $v); $ring{"$u,$v"} = $c if $c } }
    for my $c (qw(border river coast)) {
        my @pts = map { [split /,/] } sort grep { $ring{$_} eq $c } keys %ring; next unless @pts;
        my (@ent, %used);
        for my $i (0 .. $#pts) { next if $used{$i}; my @g = ($pts[$i]); $used{$i} = 1; my $grew = 1;
            while ($grew) { $grew = 0; for my $j (0 .. $#pts) { next if $used{$j}; if (grep { abs($_->[0] - $pts[$j][0]) <= 2 && abs($_->[1] - $pts[$j][1]) <= 2 } @g) { push @g, $pts[$j]; $used{$j} = 1; $grew = 1 } } }
            my ($ex, $ey) = (0, 0); $ex += $_->[0], $ey += $_->[1] for @g; ($ex, $ey) = ($ex / @g, $ey / @g);
            # direction into the hole: from the line pixels further out towards the entry point
            my ($ox, $oy, $on) = (0, 0, 0);
            for my $dy (-8 .. 8) { for my $dx (-8 .. 8) { my ($u, $v) = (int($ex + $dx + 0.5), int($ey + $dy + 0.5)); my $d2 = $dx * $dx + $dy * $dy;
                next if $d2 < 9 || $d2 > 64 || !inb($u, $v) || $hole{"$u,$v"} || cls($u, $v) ne $c; $ox += $u; $oy += $v; $on++ } }
            next unless $on; my ($dx, $dy) = ($ex - $ox / $on, $ey - $oy / $on); my $dl = sqrt($dx * $dx + $dy * $dy) || 1;
            push @ent, { x => $ex, y => $ey, dx => $dx / $dl, dy => $dy / $dl } }
        my @pairs;
        for my $i (0 .. $#ent) { for my $j ($i + 1 .. $#ent) { my ($a, $b) = ($ent[$i], $ent[$j]);
            my ($vx, $vy) = ($b->{x} - $a->{x}, $b->{y} - $a->{y}); my $vl = sqrt($vx * $vx + $vy * $vy) || 1; $vx /= $vl; $vy /= $vl;
            my $ca = $a->{dx} * $vx + $a->{dy} * $vy; my $cb = -($b->{dx} * $vx + $b->{dy} * $vy);
            push @pairs, [$i, $j, $ca + $cb] if $ca > 0.8 && $cb > 0.8 } }
        my %paired;
        for my $pr (sort { $b->[2] <=> $a->[2] } @pairs) { my ($i, $j) = @$pr; next if $paired{$i} || $paired{$j}; $paired{$i} = $paired{$j} = 1;
            push @bridges, [ $c, $ent[$i]{x}, $ent[$i]{y}, $ent[$j]{x}, $ent[$j]{y} ] }
        my @loose = grep { !$paired{$_} } 0 .. $#ent;
        if (@loose && @ent >= 2) { my ($mx, $my) = (0, 0); $mx += $_->{x}, $my += $_->{y} for @ent; ($mx, $my) = ($mx / @ent, $my / @ent);
            push @bridges, [ $c, $ent[$_]{x}, $ent[$_]{y}, $mx, $my ] for @loose } } }
for my $b (@bridges) { my ($c, $x1, $y1, $x2, $y2) = @$b; my ($rgb, $hw) = @{ $STYLE{$c} };
    ($x1, $y1, $x2, $y2) = map { $_ + 0.5 } ($x1, $y1, $x2, $y2); my ($dx, $dy) = ($x2 - $x1, $y2 - $y1); my $L2 = $dx * $dx + $dy * $dy;
    for my $y (int(($y1 < $y2 ? $y1 : $y2) - $hw) - 1 .. int(($y1 > $y2 ? $y1 : $y2) + $hw) + 1) {
        for my $x (int(($x1 < $x2 ? $x1 : $x2) - $hw) - 1 .. int(($x1 > $x2 ? $x1 : $x2) + $hw) + 1) { next unless inb($x, $y) && $hole{"$x,$y"}; my $n = 0;
            for my $sy (0 .. 3) { for my $sx (0 .. 3) { my ($px, $py) = ($x + ($sx + 0.5) / 4, $y + ($sy + 0.5) / 4);
                my $t = $L2 ? (($px - $x1) * $dx + ($py - $y1) * $dy) / $L2 : 0; $t = 0 if $t < 0; $t = 1 if $t > 1;
                $n++ if ($px - $x1 - $t * $dx)**2 + ($py - $y1 - $t * $dy)**2 <= $hw * $hw } }
            next unless $n; my $a = $n / 16; my $p = $I->[$y][$x];
            $I->[$y][$x] = [ (map { int($rgb->[$_] * $a + $p->[$_] * (1 - $a) + 0.5) } 0 .. 2), 255 ] } } }
printf "lifted %d peaks; reconnected %d line crossings underneath\n", scalar @peaks, scalar @bridges;

# markers a peak used to cover: repaint them on a clean background
if (%markerHit) { my %sub = map { ($_ => $C->{$_}) } keys %markerHit;
    for my $id (keys %sub) { for my $k (marker_pixels($C->{$id}, $isCity->{$id})) { my ($x, $y) = split /,/, $k; $I->[$y][$x] = [255, 255, 255, 255] } }
    draw_settlements($I, $W, $H, \%sub, $isCity); printf "repainted settlements %s\n", join(" ", sort { $a <=> $b } keys %sub) }

# ---------- obstacles: everything that is not plain land, plus connection lines and passes ----------
my @dist = map { [ (1e9) x $W ] } 1 .. $H; my @q;
sub mark { my ($x, $y) = @_; return unless inb($x, $y) && $dist[$y][$x]; $dist[$y][$x] = 0; push @q, [$x, $y] }
for my $y (0 .. $H - 1) { for my $x (0 .. $W - 1) { my $p = $I->[$y][$x]; mark($x, $y) unless $p->[0] == 255 && $p->[1] == 255 && $p->[2] == 255 } }
for ($_ = 0; $_ < $W; $_++) { mark($_, 0); mark($_, $H - 1) } for ($_ = 0; $_ < $H; $_++) { mark(0, $_); mark($W - 1, $_) }
for my $s (connection_segments($C, $land, $strait, $pass)) { my ($x1, $y1, $x2, $y2) = map { $_ + 0.5 } @$s[0 .. 3];
    my $L = sqrt(($x2 - $x1)**2 + ($y2 - $y1)**2); for my $i (0 .. int($L * 2)) { my $t = $L ? $i / ($L * 2) : 0; my ($x, $y) = ($x1 + ($x2 - $x1) * $t, $y1 + ($y2 - $y1) * $t);
        for my $dy (-1 .. 1) { for my $dx (-1 .. 1) { mark(int($x + $dx), int($y + $dy)) } } } }
for my $p (@$pass) { for my $dy (-12 .. 7) { for my $dx (-11 .. 11) { mark($p->{x} + $dx, $p->{y} + $dy) } } }
sub spread { my $lim = shift; while (@q) { my @n; for my $c (@q) { my ($x, $y) = @$c; my $d = $dist[$y][$x] + 1; next if $d > $lim;
        for (@N4) { my ($u, $v) = ($x + $_->[0], $y + $_->[1]); next unless inb($u, $v) && $dist[$v][$u] > $d; $dist[$v][$u] = $d; push @n, [$u, $v] } } @q = @n } }
spread(12);

# provinces: areas enclosed by borders/coast/frame (rivers do not split them), measured on the map with
# the old peaks lifted and the borders under them restored
sub pwall { my ($x, $y) = @_; my $p = $I->[$y][$x];
    return ($p->[0] == $p->[1] && $p->[1] == $p->[2] && $p->[0] >= 100 && $p->[0] <= 215) || ($p->[0] < 70 && $p->[1] < 70 && $p->[2] < 70) || ($p->[0] == 153 && $p->[1] == 217 && $p->[2] == 234) }
my @prov = map { [ (0) x $W ] } 1 .. $H; my $pid = 0;
for my $y (0 .. $H - 1) { for my $x (0 .. $W - 1) { next if $prov[$y][$x] || pwall($x, $y) || defined $mk->{"$x,$y"};
    $pid++; my @s = ([$x, $y]); $prov[$y][$x] = $pid;
    while (my $e = pop @s) { my ($a, $b) = @$e; for (@N4) { my ($u, $v) = ($a + $_->[0], $b + $_->[1]); next if !inb($u, $v) || $prov[$v][$u];
        next if pwall($u, $v);
        $prov[$v][$u] = $pid; push @s, [$u, $v] } } } }

# ---------- place each peak at the nearest clear spot ----------
my @outline;   # sample points just outside the drawn triangle, relative to the apex
{ my ($hw, $h) = ($MTN_W / 2, $MTN_H); my @v = ([0, -1.5], [-$hw - 1.5, $h + 1.2], [$hw + 1.5, $h + 1.2]);
  for my $i (0 .. 2) { my ($a, $b) = ($v[$i], $v[($i + 1) % 3]); my $n = int(sqrt(($b->[0] - $a->[0])**2 + ($b->[1] - $a->[1])**2));
      push @outline, map { [ $a->[0] + ($b->[0] - $a->[0]) * $_ / $n, $a->[1] + ($b->[1] - $a->[1]) * $_ / $n ] } 0 .. $n - 1 }
  push @outline, [0, $h * 0.66], [-$hw / 2, $h * 0.85], [$hw / 2, $h * 0.85], [0, $h * 0.3] }
my @offsets = sort { $a->[2] <=> $b->[2] } map { my $dy = $_; map { [$_, $dy, $_ * $_ + $dy * $dy] } -$REACH .. $REACH } -$REACH .. $REACH;
@offsets = grep { $_->[2] <= $REACH * $REACH } @offsets;
my (@placed, @dropped);
for my $p (sort { $a->[1] <=> $b->[1] || $a->[0] <=> $b->[0] } @peaks) {
    my ($px, $py) = @$p; my $home = $prov[ int($py + $MTN_H * 0.66) ][$px];
    unless ($home) { H: for my $r (1 .. 6) { for my $dy (-$r .. $r) { for my $dx (-$r .. $r) { my $v = $prov[ int($py + $MTN_H * 0.66) + $dy ][ $px + $dx ]; if ($v) { $home = $v; last H } } } } }
    my $spot;
    for my $o (@offsets) { my ($ax, $ay) = ($px + $o->[0], $py + $o->[1]); my $ok = 1;
        next unless $prov[ int($ay + $MTN_H * 0.66) ] && ($prov[ int($ay + $MTN_H * 0.66) ][$ax] // 0) == $home;
        for my $s (@outline) { my ($x, $y) = (int($ax + 0.5 + $s->[0]), int($ay + 0.5 + $s->[1]));
            if (!inb($x, $y) || $dist[$y][$x] < $GAP) { $ok = 0; last } }
        if ($ok) { $spot = [$ax, $ay, sqrt($o->[2])]; last } }
    unless ($spot) { push @dropped, $p; next }
    push @placed, $spot;
    # the new peak becomes an obstacle for the others
    my ($ax, $ay) = ($spot->[0] + 0.5, $spot->[1] + 0.5);
    for my $y (int($ay) - 3 .. int($ay + $MTN_H) + 3) { for my $x (int($ax - $MTN_W / 2) - 3 .. int($ax + $MTN_W / 2) + 3) {
        mark($x, $y) if inb($x, $y) && mountain_inside($ax, $ay, $x + 0.5, $y + 0.5, 1.0) } }
    spread(12) }
draw_mountain($I, $W, $H, $_->[0], $_->[1]) for sort { $a->[1] <=> $b->[1] } @placed;
save_png($file, $W, $H, $I);
open my $o, '>', "$DIR/mountains.txt" or die;
print $o "# Mountain peaks: apex position (px on map-clean.png). Written by mountains.pl.\n";
printf $o "%d %d\n", @$_[0, 1] for sort { $a->[1] <=> $b->[1] || $a->[0] <=> $b->[0] } @placed; close $o;
my @moved = grep { $_->[2] > 0 } @placed; my $maxmove = 0; $maxmove = $_->[2] > $maxmove ? $_->[2] : $maxmove for @placed;
printf "placed %d peaks (%d moved, furthest %.0fpx), dropped %d%s\n", scalar @placed, scalar @moved, $maxmove, scalar @dropped,
    @dropped ? " (no clear spot near " . join(" ", map { "$_->[0],$_->[1]" } @dropped) . ")" : '';
