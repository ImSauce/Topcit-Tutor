using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace TetraCreations.Attributes
{
	/// <summary>
	/// Used verify if a path is valid, by checking the existance of invalid characters, if the path is too long, if they are from the current Unity project etc.<br></br>
	/// It also convert full path to relative path so we can use them with the AssetDatabase API.
	/// </summary>
    public static class PathUtility
    {
		private static readonly string[] _projectFolders = { "assets", "library", "logs", "packages", "projectsettings", "temp", "usersettings" };

		private static readonly string _assetsFolder = "assets";

		public static bool EnableLog = true;

        /// <summary>
        /// Return the project's assets folder
        /// </summary>
        public static string FullAssetsPath => Application.dataPath;

		/// <summary>
		/// Returns the absolute path to the project's root folder.
		/// </summary>
		public static string FullProjectPath => FullAssetsPath.Substring(0, Application.dataPath.Length - 6);

        #region Public Methods
        /// <summary>
        /// Dertermine if the path exist on disk. It doesn't mean it is in the AssetDatabase.
        /// </summary>
        /// <param name="path"></param>
        /// <returns></returns>
        public static bool ExistOnDisk(string path) => Directory.Exists(path);

		#if UNITY_EDITOR
		/// <summary>
		/// Dertermine if the path exist in the AssetDatabase
		/// </summary>
		/// <param name="path"></param>
		/// <returns></returns>
		public static bool Exist(string path) => AssetDatabase.AssetPathToGUID(path, AssetPathToGUIDOptions.OnlyExistingAssets).Length > 0;
		#endif

		/// <summary>
		/// Determine if a path contains the unity project's root directory.
		/// </summary>
		/// <param name="fullPath"></param>
		/// <returns></returns>
		public static bool IsProjectPath(string fullPath)
		{
			// The path may already be relative, so we don't compare to the full project path
			if (IsRelative(fullPath)) { return true; }

			var projectPath = Normalize(FullProjectPath);

			fullPath = Normalize(fullPath);

			if (fullPath.StartsWith(projectPath) == false)
			{
				Debug.LogWarning(string.Format("Path: '{0}' is not from the current project, full paths must start with :  {1}", fullPath, projectPath));
				return false;
			}

			return true;
		}

		/// <summary>
		/// Determine if a path has the Assets folder has root directory
		/// </summary>
		/// <param name="path"></param>
		/// <returns></returns>
		public static bool IsInAssetsFolder(string path)
        {
			path = Normalize(path);

			if (IsRelative(path) == false) 
			{
				path = ConvertToRelativePath(path);
			}

			if(path == _assetsFolder || path.Length <= _assetsFolder.Length) { return false; }

			if (path.StartsWith(_assetsFolder) && path[_assetsFolder.Length].Equals('/'))
			{
				return true;
			}

			return false;
		}

        /// <summary>
        /// First we check if null or empty or whitespace. <br></br>
        /// Then using FileInfo instance to catch any other exceptions.<br></br>
        /// See https://learn.microsoft.com/en-us/dotnet/api/system.io.fileinfo.-ctor?view=net-8.0
        /// </summary>
        /// <returns></returns>
        public static bool IsValid(string path)
		{
			if (string.IsNullOrEmpty(path)) { return false; }

			if (string.IsNullOrWhiteSpace(path)) { return false; }

			try
			{
				FileInfo fileInfo = new FileInfo(path);
			}
			catch (Exception e)
			{
				Debug.LogError(string.Format("Path is not valid : {0}", e.ToString()));
			}

			if (HasAnyInvalidCharacters(path)) { return false; }

			return true;
		}

		#if UNITY_EDITOR
		/// <summary>
		/// Will check if the path is valid first, then it will try to make it relative and import it inside the AssetDatabase if needed.<br></br>
		/// Folders created outisde Unity need to be imported because the AssetDatabase may not be refreshed.<br></br>
		/// AssetDatabase.IsValidFolder may return false or AssetPathToGUID will not return a GUID on these folders.<br></br>
		/// It returns true if the path is valid and has the assets folder has root directory, it doesn't matter if the folder was already imported or not.
		/// </summary>
		public static bool TryToImportFolder(string path)
		{
			if (IsValid(path) == false) { return false; }

			// If the path isn't inside the Assets folder of the project
			if (IsInAssetsFolder(path) == false) { return false; }

			// Try to convert it as relative path
			var relative = ToRelative(path.FormatPath());

			// It exist on disk but not in AssetDatabase
			if (ExistOnDisk(relative) && Exist(relative) == false)
			{
				AssetDatabase.ImportAsset(relative);
			}

			return true;
		}
		#endif

		/// <summary>
		/// Convert full path to relative.<br></br> 
		/// Example : C:/Game Development/Unity/Scriptable Object Data Editor/Assets/Example<br></br>
		/// Will returns Assets/Example
		/// </summary>
		/// <param name="fullOrRelativePath"></param>
		/// <returns></returns>
		public static string ToRelative(string fullOrRelativePath)
		{
			var relativePath = fullOrRelativePath;

			if (IsRelative(relativePath) == false)
			{
				// We cannot make it relative if it's outside the project directory
				if (IsProjectPath(fullOrRelativePath) == false) { return null; }

				relativePath = ConvertToRelativePath(fullOrRelativePath);
			}

			relativePath = relativePath.Trim('/');

			return relativePath;
		}

		/// <summary>
		/// Determine if the path or the filename contain any invalid characters
		/// </summary>
		/// <param name="path"></param>
		/// <returns></returns>
		public static bool HasAnyInvalidCharacters(string path)
		{
			IEnumerable<char> pathInvalidChar = GetInvalidPathCharacters(path);

			if (pathInvalidChar.Count() > 0)
			{
				if (EnableLog == false) { return true; }

				LogInvalidCharacters(pathInvalidChar);
				return true;
			}

			// Invalid filename characters only for file path
			if (IsFilePath(path) == false) { return false; }

			var filename = Path.GetFileName(path);

			pathInvalidChar = GetInvalidFilenameCharacters(filename);

			if (pathInvalidChar.Count() > 0)
			{
				if (EnableLog == false) { return true; }

				LogInvalidCharacters(pathInvalidChar);
				return true;
			}

			return false;
		}

		/// <summary>
		/// Determine whatever a path is a file path or directory path
		/// </summary>
		/// <param name="path"></param>
		/// <returns></returns>
		public static bool IsFilePath(string path)
		{
			// Prevent an exception if the file doesn't exist yet
			if (File.Exists(path) == false) { return false; }

			FileAttributes attr = File.GetAttributes(path);

			if (attr.HasFlag(FileAttributes.Directory)) { return false; }

			return true;
		}
		#endregion

		#region Private Methods
		/// <summary>
		/// Determine if the path is relative, so it must start by one of the project folders.
		/// </summary>
		/// <param name="path"></param>
		/// <returns></returns>
		private static bool IsRelative(string path)
		{
			path = Normalize(path);

			foreach (var folder in _projectFolders)
            {
				if(path == folder) { return true; }

				if (path.Length <= folder.Length) { continue; }

				if (path.StartsWith(folder) && path[folder.Length].Equals('/')) 
				{ 
					return true; 
				}
			}

			return false;
		}

		/// <summary>
		/// Return the path in lowercase with forward slashes
		/// </summary>
		/// <param name="path"></param>
		/// <returns></returns>
		private static string Normalize(string path)
        {
			return path.FormatPath().ToLower();
		}

		/// <summary>
		/// Converts any backslashes in the path to forward slashes, supported Unity Editor platforms: Windows, Mac, Linux.
		/// </summary>
		/// <param name="path"></param>
		/// <returns></returns>
		private static string FormatPath(this string path)
        {
			return path.Replace('\\', '/');
		}

		/// <summary>
		/// Convert a full path, relative to the project path.
		/// </summary>
		/// <param name="fullOrRelativePath"></param>
		/// <returns></returns>
		private static string ConvertToRelativePath(string fullPath)
		{
			return fullPath.Substring(FullProjectPath.Length).Trim('/').FormatPath();
		}

		/// <summary>
		/// Return an IEnumerable of char which are invalid for a file name.
		/// </summary>
		/// <param name="source"></param>
		/// <returns></returns>
		private static IEnumerable<char> GetInvalidFilenameCharacters(string filename)
		{
			return Path.GetInvalidFileNameChars().Where(c => filename.Contains(c));
		}

		/// <summary>
		/// Return an IEnumerable of char which are invalid for a file name.
		/// </summary>
		/// <param name="source"></param>
		/// <returns></returns>
		private static IEnumerable<char> GetInvalidPathCharacters(string path)
		{
			return Path.GetInvalidPathChars().Where(c => path.Contains(c));
		}

		/// <summary>
		/// Display all characters in the console
		/// </summary>
		/// <param name="charArray">Array of invalid characters</param>
		private static void LogInvalidCharacters(IEnumerable<char> charArray)
		{
			if (charArray == null || charArray.Count() == 0) { return; }

			string charList = string.Empty;

			foreach (var character in charArray)
			{
				charList += Environment.NewLine + character.ToString();
			}

			Debug.LogWarning(string.Format("Following character(s) are invalid : {0}", charList));
		}
		#endregion
	}
}