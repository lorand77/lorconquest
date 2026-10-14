#!/usr/bin/perl
# Draw the settlement network (connections + mountain passes) on top of the clean map.
#
#   perl tools/map/network.pl docs/plan/map-clean.png docs/plan/map-connections.png
#
# Data: tools/map/connections.txt (who borders whom), tools/map/passes.txt (pass positions and routes).
# Prints the pass table (position, routes, owning settlement and country).
use strict; use warnings; use FindBin; require "$FindBin::Bin/common.pl";
our (%APPROX, @RED);

my ($in, $out) = @ARGV; die "usage: $0 map-clean.png out.png\n" unless $in && $out;
my ($W, $H, $I) = load_png($in);
my @ORIG = map { [ map { [@$_] } @$_ ] } @$I;
sub inb { $_[0] >= 0 && $_[1] >= 0 && $_[0] < $W && $_[1] < $H }
sub px { $ORIG[$_[1]][$_[0]] }
sub is_sea   { my $p = px(@_); $p->[0] == 153 && $p->[1] == 217 && $p->[2] == 234 }
sub is_black { my $p = px(@_); $p->[0] < 70 && $p->[1] < 70 && $p->[2] < 70 }
sub is_bgray { my $p = px(@_); $p->[0] == $p->[1] && $p->[1] == $p->[2] && $p->[0] >= 100 && $p->[0] <= 215 }
sub is_river { my $p = px(@_); $p->[2] > 150 && $p->[0] < 120 && !is_sea(@_) }
my @N4 = ([1, 0], [-1, 0], [0, 1], [0, -1]);

my ($C, $isCity, $mk) = find_settlements(\@ORIG, $W, $H);
my ($land, $strait, $NAME) = read_connections();
my ($country, $cname) = read_countries();
my $pass = read_passes();
for my $p (@$pass) { for my $r (@{ $p->{routes} }) { die "pass $p->{id}: route $r is not a connection\n" unless $land->{$r} } }

# ---------- owner of each pass: the settlement whose land it lies in ----------
my %wall;
for my $y (0 .. $H - 1) { for my $x (0 .. $W - 1) { $wall{"$x,$y"} = 1 if is_sea($x, $y) || is_black($x, $y) || (is_bgray($x, $y) && !defined $mk->{"$x,$y"}) } }
for my $y (0 .. $H - 1) { for my $x (0 .. $W - 1) { next unless is_river($x, $y);      # a river crossing a border is still a border
    for my $d ([1, 0], [0, 1], [1, 1], [1, -1]) { my ($f, $b) = (0, 0);
        for my $k (1 .. 4) { $f ||= inb($x + $d->[0] * $k, $y + $d->[1] * $k) && is_bgray($x + $d->[0] * $k, $y + $d->[1] * $k);
                             $b ||= inb($x - $d->[0] * $k, $y - $d->[1] * $k) && is_bgray($x - $d->[0] * $k, $y - $d->[1] * $k) }
        if ($f && $b) { $wall{"$x,$y"} = 1; last } } } }
for my $p (@$pass) { my ($sx, $sy) = (int($p->{x} + 0.5), int($p->{y} + 0.5));
    if ($wall{"$sx,$sy"}) { $p->{onborder} = 1; my $bd = 99; my ($nx, $ny);
        for my $dy (-6 .. 6) { for my $dx (-6 .. 6) { next if $wall{ ($sx + $dx) . "," . ($sy + $dy) }; my $d = $dx * $dx + $dy * $dy; ($bd, $nx, $ny) = ($d, $sx + $dx, $sy + $dy) if $d < $bd } }
        ($sx, $sy) = ($nx, $ny) }
    my %seen = ("$sx,$sy" => 1); my @q = ([$sx, $sy]); my $own;
    B: while (@q) { my @next; for my $c (@q) { my ($x, $y) = @$c;
        for (@N4) { my ($u, $v) = ($x + $_->[0], $y + $_->[1]); my $k = "$u,$v"; next if !inb($u, $v) || $seen{$k}++;
            if (defined $mk->{$k}) { $own = $mk->{$k}; last B } next if $wall{$k}; push @next, [$u, $v] } } @q = @next }
    $p->{owner} = $own; $p->{country} = $country->{$own} }

# ---------- draw connections ----------
sub seg { my ($x1, $y1, $x2, $y2, $hw, $cov) = @_; my ($dx, $dy) = ($x2 - $x1, $y2 - $y1); my $L2 = $dx * $dx + $dy * $dy;
    for my $y (int(($y1 < $y2 ? $y1 : $y2) - $hw) - 1 .. int(($y1 > $y2 ? $y1 : $y2) + $hw) + 1) {
        for my $x (int(($x1 < $x2 ? $x1 : $x2) - $hw) - 1 .. int(($x1 > $x2 ? $x1 : $x2) + $hw) + 1) { next unless inb($x, $y); my $c = 0;
            for my $sy (0 .. 3) { for my $sx (0 .. 3) { my ($px, $py) = ($x + ($sx + 0.5) / 4, $y + ($sy + 0.5) / 4);
                my $t = $L2 ? (($px - $x1) * $dx + ($py - $y1) * $dy) / $L2 : 0; $t = 0 if $t < 0; $t = 1 if $t > 1;
                $c++ if ($px - $x1 - $t * $dx)**2 + ($py - $y1 - $t * $dy)**2 <= $hw * $hw } }
            $cov->{"$x,$y"} = $c if $c && $c > ($cov->{"$x,$y"} // 0) } } }
my %cov;
for my $s (connection_segments($C, $land, $strait, $pass)) { my ($x1, $y1, $x2, $y2, $dashed) = map { $_ } @$s;
    ($x1, $y1, $x2, $y2) = map { $_ + 0.5 } ($x1, $y1, $x2, $y2);
    if (!$dashed) { seg($x1, $y1, $x2, $y2, 0.7, \%cov); next }
    my $L = sqrt(($x2 - $x1)**2 + ($y2 - $y1)**2); my $n = int($L / 7);
    for my $i (0 .. $n - 1) { next if $i % 2; seg($x1 + ($x2 - $x1) * $i / $n, $y1 + ($y2 - $y1) * $i / $n, $x1 + ($x2 - $x1) * ($i + 1) / $n, $y1 + ($y2 - $y1) * ($i + 1) / $n, 0.7, \%cov) } }
for my $k (keys %cov) { next if $mk->{$k}; my ($x, $y) = split /,/, $k; my $a = $cov{$k} / 16; my $p = $I->[$y][$x];
    $I->[$y][$x] = [ (map { int((190, 190, 190)[$_] * $a + $p->[$_] * (1 - $a) + 0.5) } 0 .. 2), 255 ] }

# ---------- passes: yellow triangles with a dark outline ----------
my $TS = 20;
for my $p (@$pass) { my ($cx, $cy) = ($p->{x} + 0.5, $p->{y} + 0.5); my $h = $TS * sqrt(3) / 2;
    my @v = ([$cx, $cy - 2 * $h / 3], [$cx - $TS / 2, $cy + $h / 3], [$cx + $TS / 2, $cy + $h / 3]);
    my $inside = sub { my ($x, $y, $grow) = @_;
        for my $i (0 .. 2) { my ($ax, $ay) = @{ $v[$i] }; my ($bx, $by) = @{ $v[($i + 1) % 3] };
            my ($nx, $ny) = ($by - $ay, -($bx - $ax)); my $nl = sqrt($nx * $nx + $ny * $ny); $nx /= $nl; $ny /= $nl;
            ($nx, $ny) = (-$nx, -$ny) if ($cx - $ax) * $nx + ($cy - $ay) * $ny > 0;      # outward
            return 0 if ($x - $ax) * $nx + ($y - $ay) * $ny > $grow }
        return 1 };
    for my $y (int($cy - $h) - 2 .. int($cy + $h / 2) + 2) { for my $x (int($cx - $TS / 2) - 2 .. int($cx + $TS / 2) + 2) { next unless inb($x, $y);
        my ($cin, $cout) = (0, 0);
        for my $sy (0 .. 3) { for my $sx (0 .. 3) { my ($px, $py) = ($x + ($sx + 0.5) / 4, $y + ($sy + 0.5) / 4);
            $cout++ if $inside->($px, $py, 0.6); $cin++ if $inside->($px, $py, -0.9) } }
        next unless $cout; my ($af, $al) = ($cin / 16, ($cout - $cin) / 16); my $q = $I->[$y][$x];
        $I->[$y][$x] = [ (map { int((255, 230, 0)[$_] * $af + 40 * $al + $q->[$_] * (1 - $af - $al) + 0.5) } 0 .. 2), 255 ] } } }
for my $k (keys %$mk) { my ($x, $y) = split /,/, $k; next unless inb($x, $y); $I->[$y][$x] = [ @{ $ORIG[$y][$x] } ] }
save_png($out, $W, $H, $I);

# ---------- report ----------
printf "%d settlements, %d land + %d strait connections, %d passes\n", scalar keys %$C, scalar keys %$land, scalar keys %$strait, scalar @$pass;
for my $p (@$pass) {
    printf "%s (%d,%d)  routes %-28s  land of %d %s  ->  %s %s%s\n", $p->{id}, $p->{x}, $p->{y}, join(" ", @{ $p->{routes} }),
        $p->{owner}, $NAME->{ $p->{owner} }, $p->{country}, $cname->{ $p->{country} }, $p->{onborder} ? "  [ON A BORDER LINE]" : '' }
print "wrote $out\n";
