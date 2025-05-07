interface ResetEmailProps {
  name: string;
  url: string;
}

export function ResetEmail({ name, url }: Readonly<ResetEmailProps>) {
  return (
    <div>
      <h1>
        Welcome,
        {name}
        !
      </h1>
      <p>
        Please reset your password by clicking the link below.
      </p>
      <a href={url}>Reset Password</a>
    </div>
  );
}
