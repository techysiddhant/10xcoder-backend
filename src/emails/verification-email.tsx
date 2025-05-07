import type React from "react";

interface VerificationEmailProps {
  name: string;
  url: string;
}

export function VerificationEmail({ name, url }: Readonly<VerificationEmailProps>) {
  return (
    <div>
      <h1>
        Welcome,
        {name}
        !
      </h1>
      <p>
        Please verify your email address by clicking the link below.
      </p>
      <a href={url}>Verify Email</a>
    </div>
  );
}
