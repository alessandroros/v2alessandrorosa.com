<template>
  <section id="contact" class="flex flex-col gap-6">
    <SectionTitle eyebrow="Contact">Wanna get in touch?</SectionTitle>

    <p class="text-lg text-black-primary dark:text-white-primary">
      I am always available for exciting discussions
    </p>

    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-2">
        <IconsEmail height="20" width="20" />

        <a
          class="text-lg text-[color:var(--accent-link)] underline underline-offset-4"
          href="mailto:info@alessandrorosa.com"
          >info@alessandrorosa.com</a
        >
      </div>

      <div class="flex items-center gap-2">
        <IconsPin height="20" width="20" />

        <p class="text-lg text-black-primary dark:text-white-primary">
          Trento, Italy
        </p>
      </div>
    </div>

    <div class="flex gap-4">
      <GithubLink />

      <LinkedInLink />
    </div>
  </section>
</template>
