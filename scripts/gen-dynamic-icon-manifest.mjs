/**
 * Generates the AndroidManifest.xml additions for dynamic icon support.
 * Uses activity-aliases for each icon state (default, attention, complete).
 * 
 * This script outputs the XML fragments that need to be added to 
 * android/app/src/main/AndroidManifest.xml inside the <application> tag.
 */

import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(root, 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

// Read existing manifest
import { readFileSync } from 'node:fs';
const manifest = readFileSync(manifestPath, 'utf-8');

// Generate the activity-alias entries
const activityAliases = `
        <!-- Dynamic Icon Activity Aliases -->
        <!-- Only one should be enabled at a time via PackageManager -->
        
        <!-- Default state (start of day, nothing due) -->
        <activity-alias
            android:name=".launcher.DefaultIcon"
            android:targetActivity="com.harpreetsingh29.habittracker.MainActivity"
            android:icon="@mipmap/ic_launcher_default"
            android:label="@string/app_name"
            android:enabled="true"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity-alias>

        <!-- Attention state (incomplete habits/tasks due today) -->
        <activity-alias
            android:name=".launcher.AttentionIcon"
            android:targetActivity="com.harpreetsingh29.habittracker.MainActivity"
            android:icon="@mipmap/ic_launcher_attention"
            android:label="@string/app_name"
            android:enabled="false"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity-alias>

        <!-- Complete state (all due today items done) -->
        <activity-alias
            android:name=".launcher.CompleteIcon"
            android:targetActivity="com.harpreetsingh29.habittracker.MainActivity"
            android:icon="@mipmap/ic_launcher_complete"
            android:label="@string/app_name"
            android:enabled="false"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity-alias>
`;

// Also need to generate the mipmap icons for each state (combining foreground + background)
// This will be done by a separate script that creates the full adaptive icon mipmaps

const output = `
<!-- 
Add the following inside the <application> tag in AndroidManifest.xml,
after the main MainActivity declaration:
${activityAliases}
-->

<!-- Also add these string resources to strings.xml if not present:
<string name="app_name">Evolve</string>
-->
`;

writeFileSync(join(root, 'scripts', 'dynamic-icon-manifest-fragment.xml'), activityAliases.trim());
console.log('Generated dynamic-icon-manifest-fragment.xml');
console.log('\nAdd this inside <application> tag in AndroidManifest.xml after MainActivity:');
console.log(activityAliases);