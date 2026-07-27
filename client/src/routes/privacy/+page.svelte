<script lang="ts">
	import LegalLayout from '$lib/components/legal/LegalLayout.svelte';
	import LegalSection from '$lib/components/legal/LegalSection.svelte';

	const lastUpdated = '27 July 2026';

	const sections = [
		{ id: 'scope', title: 'Scope' },
		{ id: 'information', title: 'Information We Collect' },
		{ id: 'collection', title: 'How We Collect Information' },
		{ id: 'use', title: 'How We Use Information' },
		{ id: 'google', title: 'Sign in with Google' },
		{ id: 'cookies', title: 'Cookies and Local Storage' },
		{ id: 'sharing', title: 'When We Share Information' },
		{ id: 'overseas', title: 'Overseas Processing' },
		{ id: 'security', title: 'Security' },
		{ id: 'retention', title: 'Retention and Deletion' },
		{ id: 'rights', title: 'Your Rights and Choices' },
		{ id: 'children', title: 'Children' },
		{ id: 'changes', title: 'Changes to this Policy' },
		{ id: 'contact', title: 'Contact and Complaints' }
	];
</script>

<LegalLayout
	title="Privacy Policy"
	description="How EasyDraw collects, uses, stores, and protects information when you use the Service."
	{lastUpdated}
	{sections}
>
	<div class="mt-8 rounded-xl border border-mq-red/15 bg-mq-pink px-5 py-4 sm:ml-10">
		<p class="text-sm leading-6 text-ink-soft">
			<strong class="font-semibold text-ink">The short version:</strong> we use account information
			and your diagrams to run EasyDraw. We do not sell personal information and we do not use third-party
			advertising or tracking cookies.
		</p>
	</div>

	<LegalSection id="scope" number={1} title="Scope">
		<p>
			This Privacy Policy explains how EasyDraw (“we”, “us”, or “our”) handles personal
			information when you visit, create an account, sign in, create diagrams, contact us, or
			otherwise use the EasyDraw website and application (the <strong>Service</strong>).
		</p>
		<p>
			This Policy should be read with our <a href="/terms">Terms of Service</a>. It does not
			cover a third-party service that you access independently under that provider’s own
			privacy policy.
		</p>
	</LegalSection>

	<LegalSection id="information" number={2} title="Information We Collect">
		<h3>Account and authentication information</h3>
		<ul>
			<li>your email address and, if provided, your name;</li>
			<li>a Google account identifier if you use Sign in with Google;</li>
			<li>
				a securely hashed version of your password for email/password accounts—we do not
				store your plain-text password; and
			</li>
			<li>hashed password-reset tokens and their expiry time when you request a reset.</li>
		</ul>

		<h3>Diagram content</h3>
		<p>
			We store the diagrams you save, including diagram titles, types, status, nodes,
			connections, formatting, and associated creation and update times.
		</p>

		<h3>Technical and security information</h3>
		<p>
			Our systems and infrastructure providers may process information such as your IP
			address, request method and URL, response status, timestamps, authentication sessions,
			and security or rate-limit events. We use this information to operate, troubleshoot, and
			protect the Service.
		</p>

		<h3>Browser data and communications</h3>
		<p>
			EasyDraw stores editor snapshots and interface preferences in your browser. If you email
			us, we also receive the content of your message and the contact information needed to
			reply.
		</p>
	</LegalSection>

	<LegalSection id="collection" number={3} title="How We Collect Information">
		<p>We collect information:</p>
		<ul>
			<li>directly from you when you register, create diagrams, or contact us;</li>
			<li>from Google when you choose Sign in with Google; and</li>
			<li>
				automatically from your browser and our infrastructure when you use the Service.
			</li>
		</ul>
	</LegalSection>

	<LegalSection id="use" number={4} title="How We Use Information">
		<p>We use information to:</p>
		<ul>
			<li>create and administer your account;</li>
			<li>authenticate you and keep your account secure;</li>
			<li>store, retrieve, sync, and export your diagrams;</li>
			<li>send transactional messages such as password-reset emails;</li>
			<li>provide support and respond to questions or complaints;</li>
			<li>monitor, troubleshoot, maintain, and improve the Service;</li>
			<li>prevent abuse, enforce our Terms, and protect users and the Service; and</li>
			<li>comply with legal obligations and resolve disputes.</li>
		</ul>
	</LegalSection>

	<LegalSection id="google" number={5} title="Sign in with Google">
		<p>
			If you choose Sign in with Google, Google provides us with your Google account
			identifier, name, and email address so that we can create or connect your EasyDraw
			account. EasyDraw requests only the basic <strong>email</strong> and
			<strong>profile</strong> scopes.
		</p>
		<p>
			We do not request access to your Google Drive files, contacts, calendar, or email, and
			we do not store Google access or refresh tokens in our database. Google handles your
			information under the
			<a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
				Google Privacy Policy
			</a>.
		</p>
	</LegalSection>

	<LegalSection id="cookies" number={6} title="Cookies and Local Storage">
		<p>
			EasyDraw uses an essential, HTTP-only authentication cookie to keep you signed in. The
			cookie normally expires after seven days and cannot be read by application JavaScript.
			You can remove it by signing out or clearing browser data.
		</p>
		<p>
			We use local storage on your device for editor snapshots and preferences such as sidebar
			layout and available line endings. This helps restore work and settings between visits.
			Local storage remains on that browser until EasyDraw removes it, you clear it, or your
			browser does.
		</p>
		<p>We do not currently use third-party advertising or tracking cookies.</p>
	</LegalSection>

	<LegalSection id="sharing" number={7} title="When We Share Information">
		<p>
			We do not sell, rent, or trade your personal information. We disclose information only
			as reasonably necessary:
		</p>
		<ul>
			<li>
				to service providers that help operate EasyDraw, including Amazon Web Services for
				cloud infrastructure and operational logging, Google for authentication, Twilio
				SendGrid for transactional email, Cloudflare for domain and email-routing services,
				and providers used for database and cache infrastructure;
			</li>
			<li>
				to professional advisers or authorities where reasonably necessary to comply with
				law, protect rights and safety, or investigate misuse;
			</li>
			<li>
				as part of a genuine merger, financing, reorganisation, or transfer of the Service,
				subject to appropriate confidentiality and applicable law; or
			</li>
			<li>with your direction or consent.</li>
		</ul>
		<p>
			Your diagrams are private to your account by default and are not made publicly visible
			to other EasyDraw users.
		</p>
	</LegalSection>

	<LegalSection id="overseas" number={8} title="Overseas Processing">
		<p>
			EasyDraw is operated from Australia. Some service providers may process or store
			information outside Australia, including in the United States and other countries where
			they or their subprocessors operate. Privacy protections in those locations may differ
			from Australian law.
		</p>
		<p>
			Where required, we take reasonable steps to use providers and arrangements that protect
			personal information. You can contact us for current information about the providers
			relevant to your data.
		</p>
	</LegalSection>

	<LegalSection id="security" number={9} title="Security">
		<p>
			We use reasonable technical and organisational safeguards appropriate to the Service.
			These include password hashing, hashed one-time reset tokens, HTTP-only authentication
			cookies, access controls, request rate limits, and restricted access to production
			infrastructure.
		</p>
		<p>
			No internet service or storage system is completely secure. You should use a unique
			password, protect access to your email account, sign out on shared devices, and export
			backups of important diagrams.
		</p>
		<p>
			If a data breach occurs, we will investigate and notify affected people and regulators
			where required by applicable law.
		</p>
	</LegalSection>

	<LegalSection id="retention" number={10} title="Retention and Deletion">
		<p>
			We keep account information and saved diagrams while your account is active and for as
			long as reasonably needed to provide and secure the Service. A password-reset link
			becomes unusable 30 minutes after it is issued and can be used only once.
		</p>
		<p>
			When account deletion succeeds, the active account and its saved diagrams are deleted
			from the primary application database. EasyDraw also clears its local browser storage on
			the device used to perform the deletion. Information may remain for a limited period in
			protected backups or operational records until overwritten, or where retention is
			reasonably necessary for security, fraud prevention, dispute resolution, or legal
			compliance.
		</p>
		<p>
			Exports you downloaded, copies stored in browser or device backups, and data on another
			device remain under your control and may need to be deleted separately.
		</p>
	</LegalSection>

	<LegalSection id="rights" number={11} title="Your Rights and Choices">
		<p>Depending on the law that applies, you may ask us to:</p>
		<ul>
			<li>confirm whether we hold personal information about you;</li>
			<li>provide access to, or correct, your personal information;</li>
			<li>delete your account and associated diagrams; or</li>
			<li>respond to a privacy question or complaint.</li>
		</ul>
		<p>
			You can view account details, export diagrams, and delete your account from the Service.
			For other requests, email
			<a href="mailto:support@easydraw.net">support@easydraw.net</a>. We may need to verify
			your identity before acting on a request and may retain information where the law
			permits or requires it.
		</p>
	</LegalSection>

	<LegalSection id="children" number={12} title="Children">
		<p>
			EasyDraw is not directed to children under 16, and they must not create an account. If
			you believe a child under 16 has provided personal information, contact us so we can
			investigate and take appropriate action.
		</p>
	</LegalSection>

	<LegalSection id="changes" number={13} title="Changes to this Policy">
		<p>
			We may update this Privacy Policy as the Service, our providers, or legal requirements
			change. We will post the revised version here, update the date at the top, and provide
			reasonable additional notice if a change materially affects how we handle personal
			information.
		</p>
	</LegalSection>

	<LegalSection id="contact" number={14} title="Contact and Complaints">
		<p>
			For privacy questions, access or correction requests, or complaints, email
			<a href="mailto:support@easydraw.net">support@easydraw.net</a>. Please describe your
			request and include enough information for us to investigate. We will acknowledge and
			respond within a reasonable time.
		</p>
		<p>
			If you are not satisfied with our response and the Australian Privacy Act applies, you
			may be able to complain to the
			<a
				href="https://www.oaic.gov.au/privacy/privacy-complaints"
				target="_blank"
				rel="noreferrer"
			>
				Office of the Australian Information Commissioner
			</a>.
		</p>
	</LegalSection>
</LegalLayout>
