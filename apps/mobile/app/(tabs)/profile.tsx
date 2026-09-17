import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { colors, radii, spacing } from "@/theme";
import { useAuthStore } from "@/stores/auth-store";
import { useBecomeArtist, useFollowing, useMyArtist } from "@/hooks/use-library";
import { AppText, Button, Input, LoadingView } from "@/components/ui";
import { Artwork } from "@/components/media/artwork";

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const isSigningOut = useAuthStore((state) => state.isSigningOut);
  const myArtist = useMyArtist();
  const following = useFollowing();

  if (!user) return null;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 180, gap: spacing.xl }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }}>
        <Artwork uri={user.image} seed={user.id} label={user.name} size={72} radius={36} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading">{user.name}</AppText>
          <AppText variant="bodyMuted">{user.email}</AppText>
          <AppText variant="small" style={{ color: user.role === "ARTIST" ? colors.primary : colors.textFaint }}>
            {user.role === "ARTIST" ? "ARTIST" : "LISTENER"}
          </AppText>
        </View>
      </View>

      {myArtist.data ? (
        <Button
          label="Open artist studio"
          onPress={() => router.push("/studio")}
        />
      ) : (
        <BecomeArtistCard />
      )}

      <View style={{ gap: spacing.sm }}>
        <AppText variant="heading">Following</AppText>
        {following.isLoading ? (
          <LoadingView />
        ) : (following.data?.data ?? []).length === 0 ? (
          <AppText variant="bodyMuted">You are not following any artists yet.</AppText>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {(following.data?.data ?? []).map((follow) => (
              <Pressable
                key={follow.id}
                accessibilityRole="button"
                onPress={() => router.push(`/artist/${follow.artist.id}`)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  backgroundColor: colors.surface,
                  borderRadius: radii.lg,
                  padding: spacing.md,
                }}
              >
                <Artwork uri={follow.artist.avatarUrl} seed={follow.artist.id} label={follow.artist.name} size={44} radius={22} />
                <AppText variant="subheading">{follow.artist.name}</AppText>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <Button label={isSigningOut ? "Signing out…" : "Sign out"} variant="secondary" onPress={() => void signOut()} loading={isSigningOut} />
    </ScrollView>
  );
}

function BecomeArtistCard() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const becomeArtist = useBecomeArtist();

  const refresh = useAuthStore((state) => state.refresh);

  if (!open) {
    return (
      <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.sm }}>
        <AppText variant="heading">Are you an artist?</AppText>
        <AppText variant="bodyMuted">
          Claim your artist profile to publish songs and videos, and see your stats.
        </AppText>
        <Button label="Become an artist" onPress={() => setOpen(true)} />
      </View>
    );
  }

  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.md }}>
      <AppText variant="heading">Create your artist profile</AppText>
      <Input placeholder="Artist name" value={name} onChangeText={setName} />
      <Input placeholder="Short bio (optional)" value={bio} onChangeText={setBio} multiline />
      <Button
        label="Create profile"
        loading={becomeArtist.isPending}
        onPress={() =>
          becomeArtist.mutate(
            { name: name.trim(), bio: bio.trim() || null },
            {
              onSuccess: () => {
                void refresh();
                setOpen(false);
              },
            },
          )
        }
      />
      <Button label="Cancel" variant="ghost" onPress={() => setOpen(false)} />
    </View>
  );
}