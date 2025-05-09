import { Body, Button, Container, Head, Heading, Hr, Html, Link, Section, Tailwind, Text } from '@react-email/components';
interface VerificationEmailProps {
  name: string;
  url: string;
}

export function VerificationEmail({ name, url }: Readonly<VerificationEmailProps>) {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className=" font-sans py-[40px]">
          <Container className="bg-white rounded-[16px] mx-auto p-[48px] max-w-[500px] shadow-sm">
            <Section className="mb-[32px]">
              <Text className="text-[24px] font-bold text-[#f59e0b] m-0">10xCoder.club</Text>
            </Section>
            <Section>
              <Heading className="text-[28px] font-bold text-[#111827] m-0 mb-[24px]">
                Verify your email
              </Heading>
              <Text className="text-[16px] leading-[24px] text-[#4b5563] m-0 mb-[16px]">
                Hey {name},
              </Text>
              <Text className="text-[16px] leading-[24px] text-[#4b5563] m-0 mb-[24px]">
                Thanks for joining 10xCoder.club! To complete your registration and start your journey to becoming a 10x developer, please verify your email address.
              </Text>
              <Section className="mb-[32px] mt-4">
                <Button
                  className="bg-[#f59e0b] hover:bg-[#d97706] text-white font-medium py-[12px] px-[20px] rounded-[8px] text-[14px] no-underline text-center box-border transition-colors"
                  href={url}
                >
                  Verify Email
                </Button>
              </Section>
              <Text className="text-[14px] leading-[20px] text-[#6b7280] m-0 mb-[16px]">
                This link will expire in 24 hours. If you didn't sign up for 10xCoder.club, you can safely ignore this email.
              </Text>
              <Hr className="border-[#e5e7eb] my-[32px]" />
              <Text className="text-[14px] leading-[20px] text-[#6b7280] m-0">
                Need help? <Link href="mailto:support@10xcoder.club" className="text-[#f59e0b] no-underline">Contact our support team</Link>
              </Text>
            </Section>
            <Section className="mt-[32px] pt-[32px] border-t border-[#e5e7eb]">
              <Text className="text-[12px] text-[#9ca3af] text-center m-0">
                © 2025 10xCoder.club. All rights reserved.
              </Text>
              <Text className="text-[12px] text-[#9ca3af] text-center m-0">
                Helping developers level up their coding skills
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
