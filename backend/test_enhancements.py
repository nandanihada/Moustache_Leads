"""
Test API Import Enhancements
Quick test to verify HTML cleaner and name formatter
"""

from utils.html_cleaner import clean_html_description, format_offer_name


def test_html_cleaner():
    """Test HTML description cleaner"""
    print("="*80)
    print("🧪 TESTING HTML CLEANER")
    print("="*80)
    
    test_cases = [
        {
            'input': '<p>Complete survey to earn <b>$2.50</b>!<br>New users only.</p>',
            'expected': 'Complete survey to earn $2.50!\nNew users only.'
        },
        {
            'input': '<div>Sign up and get <strong>FREE</strong> trial<br/><br/>Limited time offer!</div>',
            'expected': 'Sign up and get FREE trial\n\nLimited time offer!'
        },
        {
            'input': 'Download app &amp; complete registration.<br>Earn $5.00!',
            'expected': 'Download app & complete registration.\nEarn $5.00!'
        },
        {
            'input': '<p>Test&nbsp;&nbsp;multiple&nbsp;spaces</p>',
            'expected': 'Test multiple spaces'
        },
    ]
    
    for i, test in enumerate(test_cases, 1):
        print(f"\n📝 Test Case {i}:")
        print(f"   Input:    {test['input']}")
        result = clean_html_description(test['input'])
        print(f"   Output:   {result}")
        print(f"   Expected: {test['expected']}")
        print(f"   Status:   {'✅ PASS' if result == test['expected'] else '❌ FAIL'}")
    
    print("\n" + "="*80)


def test_name_formatter():
    """Test offer name formatter"""
    print("\n" + "="*80)
    print("🧪 TESTING NAME FORMATTER")
    print("="*80)
    
    test_cases = [
        {
            'input': 'Papa_Survey_Router_ Incent UK/DE/AU/US',
            'expected': 'Papa Survey Router - Incent UK/DE/AU/US'
        },
        {
            'input': 'iSurveyWorld_DOI_non incent US',
            'expected': 'iSurveyWorld DOI - Non Incent US'
        },
        {
            'input': 'Test_Offer_Name_With_Underscores',
            'expected': 'Test Offer Name With Underscores'
        },
        {
            'input': 'Multiple___Underscores___Test',
            'expected': 'Multiple Underscores Test'
        },
        {
            'input': 'Survey_Router non Incent',
            'expected': 'Survey Router - Non Incent'
        },
    ]
    
    for i, test in enumerate(test_cases, 1):
        print(f"\n📝 Test Case {i}:")
        print(f"   Input:    {test['input']}")
        result = format_offer_name(test['input'])
        print(f"   Output:   {result}")
        print(f"   Expected: {test['expected']}")
        print(f"   Status:   {'✅ PASS' if result == test['expected'] else '❌ FAIL'}")
    
    print("\n" + "="*80)


def test_country_mapping():
    """Test country name to code mapping"""
    print("\n" + "="*80)
    print("🧪 TESTING COUNTRY MAPPING")
    print("="*80)
    
    from services.network_field_mapper import NetworkFieldMapper
    
    mapper = NetworkFieldMapper()
    
    test_cases = [
        ('United States', 'US'),
        ('United Kingdom', 'GB'),
        ('Germany', 'DE'),
        ('Australia', 'AU'),
        ('Canada', 'CA'),
        ('France', 'FR'),
        ('Japan', 'JP'),
        ('Brazil', 'BR'),
    ]
    
    print("\n📝 Country Name → Code Mapping:")
    for name, expected_code in test_cases:
        code = mapper.COUNTRY_NAME_TO_CODE.get(name)
        status = '✅ PASS' if code == expected_code else '❌ FAIL'
        print(f"   {name:25} → {code:5} (expected: {expected_code:5}) {status}")
    
    print("\n" + "="*80)


def test_payout_type_mapping():
    """Test payout type mapping"""
    print("\n" + "="*80)
    print("🧪 TESTING PAYOUT TYPE MAPPING")
    print("="*80)
    
    from services.network_field_mapper import NetworkFieldMapper
    
    mapper = NetworkFieldMapper()
    
    test_cases = [
        ('cpa', 'CPA'),
        ('cpi', 'CPI'),
        ('cpl', 'CPL'),
        ('cps', 'CPS'),
        ('revshare', 'Revenue Share'),
        ('revenue_share', 'Revenue Share'),
        ('hybrid', 'Hybrid'),
    ]
    
    print("\n📝 Payout Type Mapping:")
    for input_type, expected_output in test_cases:
        output = mapper.PAYOUT_TYPE_MAPPING.get(input_type)
        status = '✅ PASS' if output == expected_output else '❌ FAIL'
        print(f"   {input_type:20} → {output:20} (expected: {expected_output:20}) {status}")
    
    print("\n" + "="*80)


if __name__ == '__main__':
    print("\n🚀 Starting Enhancement Tests...\n")
    
    test_html_cleaner()
    test_name_formatter()
    test_country_mapping()
    test_payout_type_mapping()
    
    print("\n✅ All tests complete!\n")
