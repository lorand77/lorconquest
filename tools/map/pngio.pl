# Minimal PNG reader/writer (8-bit RGB/RGBA, no external modules beyond core Compress::Zlib).
use strict; use warnings; use Compress::Zlib;

# load_png($file) -> ($width, $height, \@rows) ; each pixel is [r, g, b, a]
sub load_png {
    my $f = shift; open my $h, '<:raw', $f or die "$f: $!"; local $/; my $d = <$h>;
    my ($w, $hh, $ct, $idat) = (0, 0, 0, ''); my $p = 8;
    while ($p < length $d) {
        my ($len, $type) = unpack "Na4", substr($d, $p, 8); my $c = substr($d, $p + 8, $len);
        if ($type eq 'IHDR') { ($w, $hh, undef, $ct) = unpack "NNCC", $c } elsif ($type eq 'IDAT') { $idat .= $c }
        $p += 12 + $len;
    }
    my $bpp = $ct == 6 ? 4 : $ct == 2 ? 3 : die "unsupported colour type $ct";
    my $raw = uncompress($idat) // die "inflate failed";
    my $stride = $w * $bpp; my $prev = "\0" x $stride; my @img;
    for my $y (0 .. $hh - 1) {
        my $ft = ord substr($raw, $y * ($stride + 1), 1);
        my @c = unpack "C*", substr($raw, $y * ($stride + 1) + 1, $stride); my @pv = unpack "C*", $prev;
        for my $i (0 .. $#c) {
            my $a = $i >= $bpp ? $c[$i - $bpp] : 0; my $b = $pv[$i]; my $cc = $i >= $bpp ? $pv[$i - $bpp] : 0;
            if    ($ft == 1) { $c[$i] = ($c[$i] + $a) & 255 }
            elsif ($ft == 2) { $c[$i] = ($c[$i] + $b) & 255 }
            elsif ($ft == 3) { $c[$i] = ($c[$i] + int(($a + $b) / 2)) & 255 }
            elsif ($ft == 4) { my $pp = $a + $b - $cc; my ($pa, $pb, $pc) = (abs($pp - $a), abs($pp - $b), abs($pp - $cc));
                               $c[$i] = ($c[$i] + ($pa <= $pb && $pa <= $pc ? $a : $pb <= $pc ? $b : $cc)) & 255 }
        }
        $prev = pack "C*", @c;
        push @img, [ map { [ @c[$_ * $bpp .. $_ * $bpp + 2], $bpp == 4 ? $c[$_ * $bpp + 3] : 255 ] } 0 .. $w - 1 ];
    }
    return ($w, $hh, \@img);
}

# save_png($file, $width, $height, \@rows) ; writes RGBA
sub save_png {
    my ($f, $w, $h, $img) = @_;
    my $raw = ''; for my $y (0 .. $h - 1) { $raw .= "\0" . pack "C*", map { @$_ } @{ $img->[$y] } }
    my $chunk = sub { my ($t, $d) = @_; pack("N", length $d) . $t . $d . pack("N", crc32($t . $d)) };
    open my $o, '>:raw', $f or die "$f: $!";
    print $o "\x89PNG\r\n\x1a\n", $chunk->('IHDR', pack "NNCCCCC", $w, $h, 8, 6, 0, 0, 0),
             $chunk->('IDAT', compress($raw, 9)), $chunk->('IEND', '');
    close $o;
}

1;
